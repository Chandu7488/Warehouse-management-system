/**
 * StockPilot WMS - Stock Posting Service.
 *
 * The sole engine authorized to modify stock balances and append to the stock ledger.
 * Enforces atomic concurrency filters to eliminate overselling, stable composite key
 * ordering to avoid deadlocks, idempotency checks, and tracking invariants.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { StockLedgerEntry } from './stockLedgerEntry.model.js';
import { StockBalance } from './stockBalance.model.js';
import { Batch, BATCH_STATUSES } from './batch.model.js';
import { Serial, SERIAL_STATUSES } from './serial.model.js';
import { Product, TRACKING_TYPES } from '../products/product.model.js';
import { Location } from '../locations/location.model.js';
import { ApiError } from '../../utils/ApiError.js';

/**
 * Produces a stable string key for a movement leg to guarantee deterministic lock acquisition.
 *
 * @param {object} m - Normalized movement descriptor.
 * @returns {string} Comparable sort string.
 */
const getMovementSortKey = (m) => {
  const prod = String(m.product?._id || m.product);
  const loc = String(m.location?._id || m.location);
  const bat = m.batch ? String(m.batch?._id || m.batch) : '0';
  return `${prod}:${loc}:${bat}`;
};

/**
 * Validates a single movement's tracking invariants, active states, and decimal limits.
 *
 * @param {object} movement - Raw movement specification.
 * @param {mongoose.ClientSession} session - Active MongoDB transaction session.
 * @returns {Promise<object>} Enriched movement object with validated models.
 * @throws {ApiError} When any validation invariant fails.
 */
const validateMovementLeg = async (movement, session = null) => {
  const {
    product: rawProduct,
    warehouse: rawWarehouse,
    location: rawLocation,
    quantity,
  } = movement;

  if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity === 0) {
    throw ApiError.badRequest('Movement quantity must be a non-zero number');
  }

  const roundedQty = Math.round(quantity * 1000) / 1000;
  if (Math.abs(roundedQty - quantity) > 1e-9) {
    throw ApiError.badRequest('Quantities cannot have more than 3 decimal places');
  }

  const productId = rawProduct?._id || rawProduct;
  const productQuery = Product.findById(productId).populate('unit');
  if (session) {
    productQuery.session(session);
  }
  const productDoc = await productQuery;

  if (!productDoc || !productDoc.isActive) {
    throw ApiError.unprocessable('Product not found or inactive');
  }

  if (productDoc.unit && !productDoc.unit.allowDecimals && !Number.isInteger(quantity)) {
    throw ApiError.badRequest(
      `Product unit ${productDoc.unit.code} does not allow fractional quantities`,
    );
  }

  const locationId = rawLocation?._id || rawLocation;
  const locationQuery = Location.findById(locationId);
  if (session) {
    locationQuery.session(session);
  }
  const locationDoc = await locationQuery;
  if (!locationDoc || !locationDoc.isActive) {
    throw ApiError.unprocessable('Location not found or inactive');
  }

  const warehouseId = String(rawWarehouse?._id || rawWarehouse);
  if (String(locationDoc.warehouse) !== warehouseId) {
    throw ApiError.badRequest('Location does not belong to the specified warehouse');
  }

  const trackingType = productDoc.trackingType || productDoc.tracking || TRACKING_TYPES.NONE;

  let batchDoc = null;
  if (trackingType === TRACKING_TYPES.BATCH) {
    if (!movement.batch) {
      throw ApiError.badRequest(`Batch tracking is required for product ${productDoc.sku}`);
    }
    const batchId = movement.batch?._id || movement.batch;
    const batchQuery = Batch.findById(batchId);
    if (session) {
      batchQuery.session(session);
    }
    batchDoc = await batchQuery;
    if (!batchDoc) {
      throw ApiError.unprocessable(`Batch record ${batchId} not found`);
    }
    if (String(batchDoc.product) !== String(productDoc._id)) {
      throw ApiError.badRequest('Batch does not belong to the specified product');
    }
    if (
      quantity < 0 &&
      (batchDoc.status === BATCH_STATUSES.EXPIRED || batchDoc.status === BATCH_STATUSES.RECALLED)
    ) {
      throw ApiError.conflict(`Cannot issue stock from batch in ${batchDoc.status} status`);
    }
  }

  let serialDoc = null;
  if (trackingType === TRACKING_TYPES.SERIAL) {
    if (!movement.serial) {
      throw ApiError.badRequest(`Serial tracking is required for product ${productDoc.sku}`);
    }
    if (Math.abs(quantity) !== 1) {
      throw ApiError.badRequest(
        'Serial tracked items must be moved in quantities of exactly 1 or -1',
      );
    }
    const serialId = movement.serial?._id || movement.serial;
    const serialQuery = Serial.findById(serialId);
    if (session) {
      serialQuery.session(session);
    }
    serialDoc = await serialQuery;
    if (serialDoc && String(serialDoc.product) !== String(productDoc._id)) {
      throw ApiError.badRequest('Serial does not belong to the specified product');
    }
  }

  return {
    ...movement,
    quantity: roundedQty,
    productDoc,
    locationDoc,
    batchDoc,
    serialDoc,
    productId,
    warehouseId,
    locationId,
    batchId: batchDoc ? batchDoc._id : null,
    serialId: serialDoc ? serialDoc._id : null,
  };
};

/**
 * Core internal executor for validated and deadlock-ordered stock movements.
 *
 * @param {object} params - Execution parameters.
 * @param {object[]} params.validatedMovements - Sorted list of validated movements.
 * @param {mongoose.ClientSession} params.session - Active transaction session.
 * @param {object} params.actor - Authenticated user initiating the movement.
 * @param {boolean} [params.allowNegativeStock=false] - Whether negative balance is permitted.
 * @returns {Promise<object[]>} Array of saved stock ledger entries.
 * @throws {ApiError} When stock is insufficient or database constraints fail.
 */
const executeMovementsInSession = async ({
  validatedMovements,
  session,
  actor,
  allowNegativeStock = false,
}) => {
  const transactionGroupId = new mongoose.Types.ObjectId();
  const createdLedgerEntries = [];

  for (const m of validatedMovements) {
    const existingEntry = await StockLedgerEntry.findOne(
      {
        referenceType: m.referenceType,
        referenceId: m.referenceId,
        lineId: m.lineId ?? null,
        movementType: m.movementType,
        location: m.locationId,
        batch: m.batchId ?? null,
      },
      null,
      { session },
    );

    if (existingEntry) {
      createdLedgerEntries.push(existingEntry);
      continue;
    }

    const postingDate = m.postingDate ? new Date(m.postingDate) : new Date();
    const balanceFilter = {
      product: m.productId,
      warehouse: m.warehouseId,
      location: m.locationId,
      batch: m.batchId ?? null,
    };

    let updatedBalance;

    if (m.quantity > 0) {
      updatedBalance = await StockBalance.findOneAndUpdate(
        balanceFilter,
        {
          $inc: { onHand: m.quantity },
          $set: { lastMovementAt: postingDate },
        },
        {
          upsert: true,
          returnDocument: 'after',
          session,
          setDefaultsOnInsert: true,
        },
      );
    } else {
      const neededQty = Math.abs(m.quantity);
      const conditionalFilter = { ...balanceFilter };

      if (!allowNegativeStock) {
        if (m.consumesReservation) {
          conditionalFilter.onHand = { $gte: neededQty };
        } else {
          conditionalFilter.$expr = {
            $gte: [{ $subtract: ['$onHand', '$reserved'] }, neededQty],
          };
        }
      }

      const updateOp = {
        $inc: {
          onHand: m.quantity,
          ...(m.consumesReservation ? { reserved: -neededQty } : {}),
        },
        $set: { lastMovementAt: postingDate },
      };

      updatedBalance = await StockBalance.findOneAndUpdate(conditionalFilter, updateOp, {
        returnDocument: 'after',
        session,
      });

      if (!updatedBalance) {
        throw ApiError.conflict(
          `Insufficient available stock for product ${m.productDoc.sku} at location ${m.locationDoc.path}`,
        );
      }
    }

    const ledgerPayload = {
      transactionGroupId,
      postingDate,
      movementType: m.movementType,
      product: m.productId,
      warehouse: m.warehouseId,
      location: m.locationId,
      batch: m.batchId ?? null,
      serial: m.serialId ?? null,
      quantity: m.quantity,
      balanceAfter: updatedBalance.onHand,
      unitCostMinor: m.unitCostMinor ?? 0,
      valueChangeMinor: Math.round(m.quantity * (m.unitCostMinor ?? 0)),
      referenceType: m.referenceType,
      referenceId: m.referenceId,
      referenceNo: m.referenceNo ?? null,
      lineId: m.lineId ?? null,
      reason: m.reason ?? null,
      reversalOf: m.reversalOf ?? null,
      createdBy: actor._id || actor.id,
    };

    let savedEntry;
    try {
      const [inserted] = await StockLedgerEntry.create([ledgerPayload], {
        session,
      });
      savedEntry = inserted;
    } catch (err) {
      if (err.code === 11000) {
        savedEntry = await StockLedgerEntry.findOne(
          {
            referenceType: m.referenceType,
            referenceId: m.referenceId,
            lineId: m.lineId ?? null,
            movementType: m.movementType,
            location: m.locationId,
            batch: m.batchId ?? null,
          },
          null,
          { session },
        );
      } else {
        throw err;
      }
    }

    if (m.serialDoc) {
      if (m.quantity > 0) {
        await Serial.findByIdAndUpdate(
          m.serialDoc._id,
          {
            status: SERIAL_STATUSES.IN_STOCK,
            warehouse: m.warehouseId,
            location: m.locationId,
            batch: m.batchId,
          },
          { session },
        );
      } else {
        await Serial.findByIdAndUpdate(
          m.serialDoc._id,
          {
            status:
              m.movementType === 'SALES_ISSUE' ? SERIAL_STATUSES.SHIPPED : SERIAL_STATUSES.RESERVED,
            warehouse: null,
            location: null,
          },
          { session },
        );
      }
    }

    createdLedgerEntries.push(savedEntry);
  }

  return createdLedgerEntries;
};

/**
 * Posts inventory movements atomically through the Stock Ledger and Stock Balance collections.
 *
 * @param {object} options - Posting parameters.
 * @param {object[]} options.movements - Array of movement specifications.
 * @param {mongoose.ClientSession} [options.session] - Existing transaction session.
 * @param {object} options.actor - User initiating the post.
 * @param {boolean} [options.allowNegativeStock=false] - Whether negative balance is permitted.
 * @returns {Promise<object[]>} Array of posted stock ledger entry documents.
 * @throws {ApiError} When input validation fails or stock is insufficient.
 */
export const postMovements = async ({
  movements,
  session: callerSession,
  actor,
  allowNegativeStock = false,
}) => {
  if (!Array.isArray(movements) || movements.length === 0) {
    throw ApiError.badRequest('At least one movement leg is required');
  }

  if (!actor || (!actor._id && !actor.id)) {
    throw ApiError.badRequest('Actor is required for stock posting');
  }

  if (callerSession) {
    const validatedMovements = [];
    for (const m of movements) {
      validatedMovements.push(await validateMovementLeg(m, callerSession));
    }
    validatedMovements.sort((a, b) => getMovementSortKey(a).localeCompare(getMovementSortKey(b)));
    return executeMovementsInSession({
      validatedMovements,
      session: callerSession,
      actor,
      allowNegativeStock,
    });
  }

  const validatedMovements = [];
  for (const m of movements) {
    validatedMovements.push(await validateMovementLeg(m, null));
  }
  validatedMovements.sort((a, b) => getMovementSortKey(a).localeCompare(getMovementSortKey(b)));

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await executeMovementsInSession({
        validatedMovements,
        session,
        actor,
        allowNegativeStock,
      });
    });
    return result;
  } finally {
    await session.endSession();
  }
};
