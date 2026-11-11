/**
 * StockPilot WMS - Outbound Stock Allocation Engine.
 *
 * Implements intelligent inventory allocation algorithms:
 * - FEFO (First-Expired-First-Out) for perishable/batch-tracked inventory.
 * - FIFO with picking-zone priority for standard goods.
 * - Atomic soft and hard reservations to eliminate concurrency overselling.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { StockBalance } from '../inventory/stockBalance.model.js';
import { SalesOrder, SO_STATUSES } from './salesOrder.model.js';
import { LOCATION_PURPOSES } from '../locations/location.model.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Hard-allocates specific storage/picking bins for a sales order using FEFO/FIFO algorithms.
 *
 * @param {string} salesOrderId - Sales order identifier.
 * @param {mongoose.ClientSession} [session=null] - Optional MongoDB transaction session.
 * @returns {Promise<object>} Updated and allocated sales order document.
 */
export const allocateSalesOrder = async (salesOrderId, session = null) => {
  const query = SalesOrder.findById(salesOrderId).populate('items.product');
  if (session) {
    query.session(session);
  }
  const salesOrder = await query;

  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  if (salesOrder.status !== SO_STATUSES.CONFIRMED && salesOrder.status !== SO_STATUSES.DRAFT) {
    throw ApiError.badRequest(
      `Cannot allocate order in ${salesOrder.status} status. Order must be CONFIRMED or DRAFT`,
    );
  }

  const warehouseId = salesOrder.warehouse;

  for (const line of salesOrder.items) {
    const product = line.product;
    const remainingNeeded = (line.orderedQty || 0) - (line.allocatedQty || 0);

    if (remainingNeeded <= 0) {
      continue;
    }

    const balanceQuery = StockBalance.find({
      warehouse: warehouseId,
      product: product._id,
      $expr: { $gt: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
    })
      .populate('location')
      .populate('batch');

    if (session) {
      balanceQuery.session(session);
    }

    const candidateBalances = await balanceQuery;

    // Filter to valid storage or picking locations only
    const validBalances = candidateBalances.filter(
      (b) =>
        b.location &&
        b.location.isActive &&
        (b.location.purpose === LOCATION_PURPOSES.PICKING ||
          b.location.purpose === LOCATION_PURPOSES.STORAGE),
    );

    // Sort algorithm: FEFO for batches, otherwise PICKING zones first then path
    validBalances.sort((a, b) => {
      // 1. FEFO if batches have expiry dates
      if (a.batch?.expiresOn && b.batch?.expiresOn) {
        const diff = new Date(a.batch.expiresOn).getTime() - new Date(b.batch.expiresOn).getTime();
        if (diff !== 0) {
          return diff;
        }
      } else if (a.batch?.expiresOn && !b.batch?.expiresOn) {
        return -1;
      } else if (!a.batch?.expiresOn && b.batch?.expiresOn) {
        return 1;
      }

      // 2. Zone purpose: PICKING zones prioritized before STORAGE zones
      if (
        a.location.purpose === LOCATION_PURPOSES.PICKING &&
        b.location.purpose !== LOCATION_PURPOSES.PICKING
      ) {
        return -1;
      }
      if (
        b.location.purpose === LOCATION_PURPOSES.PICKING &&
        a.location.purpose !== LOCATION_PURPOSES.PICKING
      ) {
        return 1;
      }

      // 3. Location path
      return (a.location.path || '').localeCompare(b.location.path || '');
    });

    let qtyStillNeeded = remainingNeeded;
    for (const bal of validBalances) {
      const available = (bal.onHand || 0) - (bal.reserved || 0);
      if (available <= 0) {
        continue;
      }

      const qtyToAllocate = Math.min(qtyStillNeeded, available);

      const updateFilter = {
        _id: bal._id,
        $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, qtyToAllocate] },
      };

      const updateOp = {
        $inc: { reserved: qtyToAllocate },
      };

      const updateOpts = { returnDocument: 'after' };
      if (session) {
        updateOpts.session = session;
      }

      const updated = await StockBalance.findOneAndUpdate(updateFilter, updateOp, updateOpts);
      if (!updated) {
        // Concurrently claimed by another worker; continue to next candidate
        continue;
      }

      line.allocations.push({
        location: bal.location._id,
        batch: bal.batch ? bal.batch._id : null,
        serial: null,
        quantity: qtyToAllocate,
      });

      line.allocatedQty += qtyToAllocate;
      qtyStillNeeded -= qtyToAllocate;

      if (qtyStillNeeded <= 0) {
        break;
      }
    }

    if (qtyStillNeeded > 0) {
      throw ApiError.conflict(
        `Insufficient available stock for product ${product.sku} (${product.name}). Shortage of ${qtyStillNeeded} units`,
      );
    }
  }

  salesOrder.status = SO_STATUSES.ALLOCATED;
  if (session) {
    await salesOrder.save({ session });
  } else {
    await salesOrder.save();
  }

  return salesOrder;
};

/**
 * Releases all hard-allocated stock reservations for a sales order.
 *
 * @param {string} salesOrderId - Sales order identifier.
 * @param {mongoose.ClientSession} [session=null] - Optional MongoDB transaction session.
 * @returns {Promise<object>} Deallocated sales order document.
 */
export const deallocateSalesOrder = async (salesOrderId, session = null) => {
  const query = SalesOrder.findById(salesOrderId);
  if (session) {
    query.session(session);
  }
  const salesOrder = await query;

  if (!salesOrder) {
    throw ApiError.notFound('Sales order not found');
  }

  for (const line of salesOrder.items) {
    for (const alloc of line.allocations) {
      const updateFilter = {
        warehouse: salesOrder.warehouse,
        product: line.product,
        location: alloc.location,
        batch: alloc.batch || null,
      };

      const updateOp = {
        $inc: { reserved: -alloc.quantity },
      };

      const updateOpts = {};
      if (session) {
        updateOpts.session = session;
      }

      await StockBalance.findOneAndUpdate(updateFilter, updateOp, updateOpts);
    }
    line.allocations = [];
    line.allocatedQty = 0;
  }

  if (salesOrder.status === SO_STATUSES.ALLOCATED) {
    salesOrder.status = SO_STATUSES.CONFIRMED;
  }

  if (session) {
    await salesOrder.save({ session });
  } else {
    await salesOrder.save();
  }

  return salesOrder;
};
