/**
 * StockPilot WMS - Stock Allocation Service.
 *
 * Implements FEFO (First-Expired, First-Out) and FIFO (First-In, First-Out) allocation
 * algorithms for customer orders and reservation management.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { StockBalance } from './stockBalance.model.js';
import { Reservation, RESERVATION_STATUSES } from './reservation.model.js';
import { BATCH_STATUSES } from './batch.model.js';
import { Location, LOCATION_PURPOSES } from '../locations/location.model.js';
import { Product } from '../products/product.model.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Allocates available stock for an outbound order line using FEFO or FIFO strategies.
 *
 * @param {object} params - Allocation criteria.
 * @param {string|object} params.salesOrderId - Source sales order identifier.
 * @param {string|object} params.lineId - Source line item identifier.
 * @param {string} params.warehouseId - Warehouse where stock must be reserved.
 * @param {string} params.productId - Product to allocate.
 * @param {number} params.requestedQty - Quantity requested for allocation.
 * @param {mongoose.ClientSession} params.session - Active transaction session.
 * @returns {Promise<object[]>} Array of created reservation documents.
 * @throws {ApiError} When unreserved stock is insufficient or inputs are invalid.
 */
export const allocateStock = async ({
  salesOrderId,
  lineId,
  warehouseId,
  productId,
  requestedQty,
  session,
}) => {
  if (typeof requestedQty !== 'number' || requestedQty <= 0) {
    throw ApiError.badRequest('Requested quantity must be greater than zero');
  }

  const productDoc = await Product.findById(productId).session(session);
  if (!productDoc || !productDoc.isActive) {
    throw ApiError.unprocessable('Product not found or inactive');
  }

  const eligibleLocations = await Location.find({
    warehouse: warehouseId,
    purpose: { $in: [LOCATION_PURPOSES.STORAGE, LOCATION_PURPOSES.PICKING] },
    isActive: true,
  })
    .select('_id')
    .session(session);

  const eligibleLocationIds = eligibleLocations.map((l) => l._id);

  const candidateBalances = await StockBalance.find({
    product: productId,
    warehouse: warehouseId,
    location: { $in: eligibleLocationIds },
    $expr: { $gt: [{ $subtract: ['$onHand', '$reserved'] }, 0] },
  }).populate('batch');

  const validBalances = candidateBalances.filter((b) => {
    if (!b.batch) {
      return true;
    }
    return (
      b.batch.status !== BATCH_STATUSES.EXPIRED &&
      b.batch.status !== BATCH_STATUSES.QUARANTINED &&
      b.batch.status !== BATCH_STATUSES.RECALLED
    );
  });

  if (productDoc.hasExpiry) {
    validBalances.sort((a, b) => {
      const timeA = a.batch?.expiresOn ? new Date(a.batch.expiresOn).getTime() : Infinity;
      const timeB = b.batch?.expiresOn ? new Date(b.batch.expiresOn).getTime() : Infinity;
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      return new Date(a.lastMovementAt).getTime() - new Date(b.lastMovementAt).getTime();
    });
  } else {
    validBalances.sort(
      (a, b) => new Date(a.lastMovementAt).getTime() - new Date(b.lastMovementAt).getTime(),
    );
  }

  let remaining = requestedQty;
  const createdReservations = [];

  for (const b of validBalances) {
    if (remaining <= 0) {
      break;
    }

    const available = (b.onHand || 0) - (b.reserved || 0);
    if (available <= 0) {
      continue;
    }

    const allocQty = Math.min(remaining, available);

    const updatedBalance = await StockBalance.findOneAndUpdate(
      {
        _id: b._id,
        $expr: { $gte: [{ $subtract: ['$onHand', '$reserved'] }, allocQty] },
      },
      {
        $inc: { reserved: allocQty },
      },
      {
        returnDocument: 'after',
        session,
      },
    );

    if (!updatedBalance) {
      continue;
    }

    const [reservation] = await Reservation.create(
      [
        {
          salesOrder: salesOrderId,
          lineId,
          product: productId,
          warehouse: warehouseId,
          location: b.location,
          batch: b.batch?._id ?? null,
          quantity: allocQty,
          status: RESERVATION_STATUSES.ACTIVE,
        },
      ],
      { session },
    );

    createdReservations.push(reservation);
    remaining = Math.round((remaining - allocQty) * 1000) / 1000;
  }

  if (remaining > 0) {
    throw ApiError.conflict(
      `Insufficient available unreserved stock for product ${productDoc.sku}. Short by ${remaining}`,
    );
  }

  return createdReservations;
};

/**
 * Releases an active reservation, returning the reserved stock to available inventory.
 *
 * @param {object} params - Release criteria.
 * @param {string} params.reservationId - Reservation to release.
 * @param {mongoose.ClientSession} params.session - Active transaction session.
 * @returns {Promise<object>} The updated reservation document.
 * @throws {ApiError} When reservation is not found or not in ACTIVE status.
 */
export const releaseReservation = async ({ reservationId, session }) => {
  const reservation = await Reservation.findById(reservationId).session(session);
  if (!reservation) {
    throw ApiError.notFound('Reservation not found');
  }

  if (reservation.status !== RESERVATION_STATUSES.ACTIVE) {
    throw ApiError.conflict(
      `Only ACTIVE reservations can be released, current status is ${reservation.status}`,
    );
  }

  await StockBalance.findOneAndUpdate(
    {
      product: reservation.product,
      warehouse: reservation.warehouse,
      location: reservation.location,
      batch: reservation.batch,
    },
    {
      $inc: { reserved: -reservation.quantity },
    },
    { session },
  );

  reservation.status = RESERVATION_STATUSES.RELEASED;
  await reservation.save({ session });

  return reservation;
};
