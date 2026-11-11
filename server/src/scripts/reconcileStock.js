/**
 * StockPilot WMS - Stock Ledger Reconciliation Script.
 *
 * Verifies mathematical parity between append-only stock ledger entries and
 * current stock balance records across all products, warehouses, locations, and lots.
 *
 * Usage:
 *   node src/scripts/reconcileStock.js
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { StockBalance } from '../modules/inventory/stockBalance.model.js';
import { StockLedgerEntry } from '../modules/inventory/stockLedgerEntry.model.js';

/**
 * Executes a full audit reconciliation comparing ledger entry sums against balance records.
 *
 * @returns {Promise<{discrepancyCount: number, auditedKeysCount: number}>} Audit metrics.
 */
export const runReconciliation = async () => {
  const ledgerTotals = await StockLedgerEntry.aggregate([
    {
      $group: {
        _id: {
          product: '$product',
          warehouse: '$warehouse',
          location: '$location',
          batch: '$batch',
        },
        totalQty: { $sum: '$quantity' },
        entryCount: { $sum: 1 },
      },
    },
  ]);

  const ledgerMap = new Map();
  for (const group of ledgerTotals) {
    const key = `${group._id.product}:${group._id.warehouse}:${group._id.location}:${group._id.batch ?? 'null'}`;
    ledgerMap.set(key, {
      totalQty: Math.round(group.totalQty * 1000) / 1000,
      entryCount: group.entryCount,
    });
  }

  const allBalances = await StockBalance.find().lean();
  const balanceMap = new Map();
  for (const b of allBalances) {
    const key = `${b.product}:${b.warehouse}:${b.location}:${b.batch ?? 'null'}`;
    balanceMap.set(key, Math.round(b.onHand * 1000) / 1000);
  }

  const allKeys = new Set([...ledgerMap.keys(), ...balanceMap.keys()]);
  const discrepancies = [];

  for (const key of allKeys) {
    const ledgerSum = ledgerMap.get(key)?.totalQty ?? 0;
    const balanceOnHand = balanceMap.get(key) ?? 0;

    if (Math.abs(ledgerSum - balanceOnHand) > 1e-6) {
      discrepancies.push({
        key,
        ledgerSum,
        balanceOnHand,
        difference: Math.round((balanceOnHand - ledgerSum) * 1000) / 1000,
      });
    }
  }

  return {
    auditedKeysCount: allKeys.size,
    ledgerTotalsCount: ledgerTotals.length,
    balanceRecordsCount: allBalances.length,
    discrepancyCount: discrepancies.length,
    discrepancies,
  };
};

/**
 * Main script runner establishing connection and reporting audit results.
 *
 * @returns {Promise<void>}
 */
const main = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Starting StockPilot stock ledger reconciliation...');

    const result = await runReconciliation();

    logger.info('Reconciliation completed', {
      auditedCombinations: result.auditedKeysCount,
      ledgerGroups: result.ledgerTotalsCount,
      balanceRecords: result.balanceRecordsCount,
      discrepancies: result.discrepancyCount,
    });

    if (result.discrepancyCount > 0) {
      logger.error('CRITICAL: Stock reconciliation found discrepancies', {
        discrepancies: result.discrepancies,
      });
      process.exitCode = 1;
    } else {
      logger.info('SUCCESS: All stock balances strictly match the ledger records');
      process.exitCode = 0;
    }
  } catch (err) {
    logger.error('Stock reconciliation failed with error', {
      error: err.message,
    });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

if (process.argv[1]?.endsWith('reconcileStock.js')) {
  main();
}
