/**
 * StockPilot WMS - Master Data seed script.
 *
 * Populates initial standard measurement units, categories, demo catalog products,
 * commercial partners, and primary warehouse facilities into MongoDB Atlas.
 *
 * Usage:
 *   node src/scripts/seedMasterData.js
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { Unit } from '../modules/units/unit.model.js';
import { Category } from '../modules/categories/category.model.js';
import { Product, TRACKING_TYPES } from '../modules/products/product.model.js';
import { Supplier } from '../modules/suppliers/supplier.model.js';
import { Customer } from '../modules/customers/customer.model.js';
import { Warehouse } from '../modules/warehouses/warehouse.model.js';
import {
  Location,
  LOCATION_TYPES,
  LOCATION_PURPOSES,
} from '../modules/locations/location.model.js';
import {
  ensureSystemLocations,
  createLocation,
  bulkCreateLocations,
} from '../modules/locations/location.service.js';
import { User } from '../modules/users/user.model.js';
import { StockLedgerEntry } from '../modules/inventory/stockLedgerEntry.model.js';
import { postOpeningBalance } from '../modules/inventory/inventory.service.js';
import { PurchaseOrder, PO_STATUSES } from '../modules/purchasing/purchaseOrder.model.js';
import { SalesOrder, SO_STATUSES } from '../modules/outbound/salesOrder.model.js';
import {
  ReturnOrder,
  RETURN_TYPES,
  RMA_STATUSES,
  ITEM_CONDITIONS,
  DISPOSITION_TYPES,
} from '../modules/returns/returnOrder.model.js';
import {
  TransferOrder,
  TRANSFER_TYPES,
  TRANSFER_STATUSES,
} from '../modules/transfers/transferOrder.model.js';
import { ReplenishmentRule } from '../modules/transfers/replenishmentRule.model.js';

/**
 * Executes master data seeding operations.
 *
 * @returns {Promise<void>}
 */
const seedMasterData = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB Atlas for Master Data seeding');

    const unitsConfig = [
      { code: 'PCS', name: 'Pieces', allowDecimals: false },
      { code: 'KG', name: 'Kilograms', allowDecimals: true },
      { code: 'BOX', name: 'Standard Box', allowDecimals: false },
      { code: 'LTR', name: 'Liters', allowDecimals: true },
    ];

    const unitMap = new Map();
    for (const u of unitsConfig) {
      let doc = await Unit.findOne({ code: u.code });
      if (!doc) {
        doc = await Unit.create(u);
        logger.info(`Created unit: ${u.code}`);
      }
      unitMap.set(u.code, doc);
    }

    const categoriesConfig = [
      { name: 'Electronics', description: 'Consumer electronics, computers, and accessories' },
      {
        name: 'Industrial Hardware',
        description: 'Tools, solder wire, fasteners, and workshop equipment',
      },
      {
        name: 'Packaging Supplies',
        description: 'Cartons, bubble wrap, poly mailers, and pallet stretch film',
      },
    ];

    const categoryMap = new Map();
    for (const c of categoriesConfig) {
      let doc = await Category.findOne({ name: c.name });
      if (!doc) {
        doc = await Category.create(c);
        logger.info(`Created category: ${c.name}`);
      }
      categoryMap.set(c.name, doc);
    }

    const warehousesConfig = [
      {
        code: 'WH-MAIN',
        name: 'Main Distribution Hub',
        address: {
          line1: '1000 Logistics Parkway',
          city: 'Dallas',
          state: 'TX',
          postalCode: '75201',
          country: 'USA',
        },
      },
      {
        code: 'WH-EAST',
        name: 'East Coast Center',
        address: {
          line1: '450 Terminal Road',
          city: 'Atlanta',
          state: 'GA',
          postalCode: '30301',
          country: 'USA',
        },
      },
    ];

    const warehouseMap = new Map();
    for (const w of warehousesConfig) {
      let doc = await Warehouse.findOne({ code: w.code });
      if (!doc) {
        doc = await Warehouse.create(w);
        logger.info(`Created warehouse: ${w.code}`);
      }
      warehouseMap.set(w.code, doc);

      const sysLocs = await ensureSystemLocations(doc._id);
      if (sysLocs.length > 0) {
        logger.info(`Provisioned ${sysLocs.length} system locations for ${w.code}`);
      }
    }

    const mainWh = warehouseMap.get('WH-MAIN');
    if (mainWh) {
      let zoneA = await Location.findOne({ warehouse: mainWh._id, code: 'ZONE-A' });
      if (!zoneA) {
        zoneA = await createLocation({
          warehouse: mainWh._id,
          parent: null,
          type: LOCATION_TYPES.ZONE,
          purpose: LOCATION_PURPOSES.STORAGE,
          code: 'ZONE-A',
        });
        logger.info('Created ZONE-A in WH-MAIN');
      }

      const existingRack = await Location.findOne({ warehouse: mainWh._id, code: 'RACK-01' });
      if (!existingRack) {
        await bulkCreateLocations({
          warehouse: mainWh._id,
          zone: zoneA._id,
          rackCode: 'RACK-01',
          purpose: LOCATION_PURPOSES.STORAGE,
          shelvesCount: 3,
          binsPerShelf: 4,
        });
        logger.info('Bulk generated RACK-01 (3 shelves, 4 bins per shelf) in WH-MAIN ZONE-A');
      }

      let zoneB = await Location.findOne({ warehouse: mainWh._id, code: 'ZONE-B' });
      if (!zoneB) {
        zoneB = await createLocation({
          warehouse: mainWh._id,
          parent: null,
          type: LOCATION_TYPES.ZONE,
          purpose: LOCATION_PURPOSES.PICKING,
          code: 'ZONE-B',
        });
        logger.info('Created ZONE-B in WH-MAIN');
      }

      const existingRackB = await Location.findOne({ warehouse: mainWh._id, code: 'RACK-02' });
      if (!existingRackB) {
        await bulkCreateLocations({
          warehouse: mainWh._id,
          zone: zoneB._id,
          rackCode: 'RACK-02',
          purpose: LOCATION_PURPOSES.PICKING,
          shelvesCount: 2,
          binsPerShelf: 3,
        });
        logger.info('Bulk generated RACK-02 (2 shelves, 3 bins per shelf) in WH-MAIN ZONE-B');
      }
    }

    const suppliersConfig = [
      {
        code: 'SUP-GLOBAL-01',
        name: 'Global Component Distributors LLC',
        email: 'sales@globalcomponents.example',
        phone: '+1-555-0144',
        paymentTermsDays: 30,
        notes: 'Primary electronic component supplier. Free shipping over $2,000.',
        address: {
          line1: '78 Industrial Park',
          city: 'Chicago',
          state: 'IL',
          postalCode: '60601',
          country: 'USA',
        },
      },
      {
        code: 'SUP-PACIFIC-02',
        name: 'Pacific Hardware Direct',
        email: 'orders@pacifichardware.example',
        phone: '+1-555-0188',
        paymentTermsDays: 15,
        notes: 'Hardware vendor. Net 15 days payment agreement.',
        address: {
          line1: '22 Ocean Way',
          city: 'Seattle',
          state: 'WA',
          postalCode: '98101',
          country: 'USA',
        },
      },
    ];

    for (const s of suppliersConfig) {
      const existing = await Supplier.findOne({ code: s.code });
      if (!existing) {
        await Supplier.create(s);
        logger.info(`Created supplier: ${s.code}`);
      }
    }

    const customersConfig = [
      {
        code: 'CUST-ACME-01',
        name: 'Acme Retail Solutions Inc',
        email: 'procurement@acmeretail.example',
        phone: '+1-555-0199',
        paymentTermsDays: 30,
        notes: 'High-volume corporate retail client.',
        address: {
          line1: '500 Commerce Blvd',
          city: 'New York',
          state: 'NY',
          postalCode: '10001',
          country: 'USA',
        },
      },
      {
        code: 'CUST-APEX-02',
        name: 'Apex Manufacturing Corp',
        email: 'receiving@apexmaker.example',
        phone: '+1-555-0177',
        paymentTermsDays: 45,
        notes: 'Industrial plant receiving facility.',
        address: {
          line1: '12 Plant Gate Rd',
          city: 'Detroit',
          state: 'MI',
          postalCode: '48201',
          country: 'USA',
        },
      },
    ];

    for (const cu of customersConfig) {
      const existing = await Customer.findOne({ code: cu.code });
      if (!existing) {
        await Customer.create(cu);
        logger.info(`Created customer: ${cu.code}`);
      }
    }

    const productsConfig = [
      {
        sku: 'LAPTOP-PRO-15',
        name: 'Pro Laptop 15-inch M3',
        description: 'High-performance workstation laptop 32GB RAM 1TB SSD',
        category: categoryMap.get('Electronics')._id,
        unit: unitMap.get('PCS')._id,
        trackingType: TRACKING_TYPES.SERIAL,
        hasExpiry: false,
        barcode: '793573179001',
        costPriceMinor: 85000,
        salePriceMinor: 129900,
        reorderLevel: 5,
        reorderQuantity: 20,
        weightKg: 1.85,
      },
      {
        sku: 'SOLDER-LEAD-FREE-1KG',
        name: 'Lead-Free Solder Wire Spool 1kg',
        description: 'Sn99.3 Cu0.7 0.8mm flux core industrial solder spool',
        category: categoryMap.get('Industrial Hardware')._id,
        unit: unitMap.get('KG')._id,
        trackingType: TRACKING_TYPES.BATCH,
        hasExpiry: true,
        barcode: '793573179002',
        costPriceMinor: 1850,
        salePriceMinor: 3200,
        reorderLevel: 10,
        reorderQuantity: 50,
        weightKg: 1.0,
      },
      {
        sku: 'SHIPPING-BOX-M',
        name: 'Corrugated Shipping Box Medium (12x10x8)',
        description: 'Single-wall ECT-32 kraft corrugated shipping carton',
        category: categoryMap.get('Packaging Supplies')._id,
        unit: unitMap.get('BOX')._id,
        trackingType: TRACKING_TYPES.NONE,
        hasExpiry: false,
        barcode: '793573179003',
        costPriceMinor: 65,
        salePriceMinor: 150,
        reorderLevel: 100,
        reorderQuantity: 500,
        weightKg: 0.25,
      },
      {
        sku: 'BOLT-HEX-M8-50',
        name: 'Hex Bolt M8 x 50mm Stainless Steel',
        description: 'Standard grade A2-70 stainless steel hexagonal bolt',
        category: categoryMap.get('Industrial Hardware')._id,
        unit: unitMap.get('PCS')._id,
        trackingType: TRACKING_TYPES.NONE,
        hasExpiry: false,
        barcode: '793573179004',
        costPriceMinor: 45,
        salePriceMinor: 95,
        reorderLevel: 50,
        reorderQuantity: 200,
        weightKg: 0.05,
      },
    ];

    for (const p of productsConfig) {
      const existing = await Product.findOne({ sku: p.sku });
      if (!existing) {
        await Product.create(p);
        logger.info(`Created product: ${p.sku}`);
      }
    }

    const adminUser =
      (await User.findOne({ email: 'admin@stockpilot.local' })) ||
      (await User.findOne({ role: 'ADMIN' }));
    const ledgerCount = await StockLedgerEntry.countDocuments();
    if (adminUser && ledgerCount === 0) {
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });
      const solderProduct = await Product.findOne({ sku: 'SOLDER-LEAD-FREE-1KG' });
      const boxProduct = await Product.findOne({ sku: 'SHIPPING-BOX-M' });
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const storageBin = await Location.findOne({
        warehouse: mainWarehouse._id,
        type: LOCATION_TYPES.BIN,
      });

      if (boltProduct && solderProduct && boxProduct && storageBin) {
        await postOpeningBalance({
          warehouseId: mainWarehouse._id.toString(),
          items: [
            {
              product: boltProduct._id.toString(),
              location: storageBin._id.toString(),
              quantity: 250,
              unitCostMinor: 45,
              reason: 'Initial warehouse stock seeding',
            },
            {
              product: solderProduct._id.toString(),
              location: storageBin._id.toString(),
              quantity: 35,
              unitCostMinor: 1850,
              batchNumber: 'LOT-2026-SP1',
              expiresOn: '2027-12-31',
              reason: 'Initial warehouse lot stock seeding',
            },
            {
              product: boxProduct._id.toString(),
              location: storageBin._id.toString(),
              quantity: 500,
              unitCostMinor: 65,
              reason: 'Initial packaging stock seeding',
            },
          ],
          actor: adminUser,
        });
        logger.info('Seeded sample opening inventory balances');
      }
    }

    const poCount = await PurchaseOrder.countDocuments();
    if (adminUser && poCount === 0) {
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const supplier = await Supplier.findOne({ code: 'SUP-ACME' }) || (await Supplier.findOne());
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });
      const solderProduct = await Product.findOne({ sku: 'SOLDER-LEAD-FREE-1KG' });

      if (mainWarehouse && supplier && boltProduct && solderProduct) {
        const item1Ordered = 100;
        const item1Price = boltProduct.costPriceMinor || 45;
        const item2Ordered = 20;
        const item2Price = solderProduct.costPriceMinor || 1850;
        const totalMinor = item1Ordered * item1Price + item2Ordered * item2Price;

        await PurchaseOrder.create({
          poNumber: 'PO-2026-0001',
          supplier: supplier._id,
          warehouse: mainWarehouse._id,
          status: PO_STATUSES.CONFIRMED,
          expectedDeliveryDate: new Date(Date.now() + 5 * 86400000),
          items: [
            {
              product: boltProduct._id,
              orderedQty: item1Ordered,
              receivedQty: 0,
              unitPriceMinor: item1Price,
              totalPriceMinor: item1Ordered * item1Price,
            },
            {
              product: solderProduct._id,
              orderedQty: item2Ordered,
              receivedQty: 0,
              unitPriceMinor: item2Price,
              totalPriceMinor: item2Ordered * item2Price,
            },
          ],
          subtotalMinor: totalMinor,
          taxMinor: 0,
          totalMinor: totalMinor,
          notes: 'Standard monthly replenishment contract',
          createdBy: adminUser._id,
        });

        logger.info('Seeded sample confirmed purchase order: PO-2026-0001');
      }
    }

    const soCount = await SalesOrder.countDocuments();
    if (adminUser && soCount === 0) {
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const customer = (await Customer.findOne({ code: 'CUST-APEX' })) || (await Customer.findOne());
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });

      if (mainWarehouse && customer && boltProduct) {
        const orderedQty = 15;
        const unitPriceMinor = boltProduct.salePriceMinor || 75;
        const totalMinor = orderedQty * unitPriceMinor;

        await SalesOrder.create({
          soNumber: 'SO-2026-0001',
          customer: customer._id,
          warehouse: mainWarehouse._id,
          status: SO_STATUSES.CONFIRMED,
          requestedDeliveryDate: new Date(Date.now() + 3 * 86400000),
          shippingAddress: {
            street: customer.address?.street || '742 Evergreen Terrace',
            city: customer.address?.city || 'Springfield',
            state: customer.address?.state || 'OR',
            postalCode: customer.address?.postalCode || '97477',
            country: 'US',
          },
          items: [
            {
              product: boltProduct._id,
              orderedQty,
              allocatedQty: 0,
              pickedQty: 0,
              packedQty: 0,
              shippedQty: 0,
              unitPriceMinor,
              totalPriceMinor: totalMinor,
            },
          ],
          subtotalMinor: totalMinor,
          taxMinor: 0,
          shippingMinor: 0,
          totalMinor: totalMinor,
          notes: 'Priority customer fulfillment order',
          createdBy: adminUser._id,
        });

        logger.info('Seeded sample confirmed sales order: SO-2026-0001');
      }
    }

    const rmaCount = await ReturnOrder.countDocuments();
    if (adminUser && rmaCount === 0) {
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const customer = (await Customer.findOne({ code: 'CUST-APEX' })) || (await Customer.findOne());
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });

      if (mainWarehouse && customer && boltProduct) {
        await ReturnOrder.create({
          rmaNumber: 'RMA-2026-0001',
          returnType: RETURN_TYPES.CUSTOMER_RETURN,
          warehouse: mainWarehouse._id,
          customer: customer._id,
          status: RMA_STATUSES.PENDING_RECEIPT,
          trackingNumber: 'RET-FEDEX-889922',
          notes: 'Customer reported minor transit box crushing; requesting inspection and restock.',
          items: [
            {
              product: boltProduct._id,
              expectedQty: 5,
              receivedQty: 0,
              inspectedQty: 0,
              condition: ITEM_CONDITIONS.NEW,
              disposition: DISPOSITION_TYPES.PENDING,
              reason: 'TRANSIT_DAMAGE',
              reasonNotes: 'Outer packaging slightly torn in shipping transit',
            },
          ],
          createdBy: adminUser._id,
        });

        logger.info('Seeded sample customer return: RMA-2026-0001');
      }
    }

    const transferCount = await TransferOrder.countDocuments();
    if (adminUser && transferCount === 0) {
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const eastWarehouse = await Warehouse.findOne({ code: 'WH-EAST' });
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });
      const sourceBin = await Location.findOne({
        warehouse: mainWarehouse?._id,
        purpose: LOCATION_PURPOSES.STORAGE,
        type: LOCATION_TYPES.BIN,
      });

      if (mainWarehouse && eastWarehouse && boltProduct && sourceBin) {
        await TransferOrder.create({
          transferNumber: 'TO-2026-0001',
          transferType: TRANSFER_TYPES.INTER_WAREHOUSE,
          originWarehouse: mainWarehouse._id,
          destinationWarehouse: eastWarehouse._id,
          status: TRANSFER_STATUSES.PENDING_DISPATCH,
          carrier: 'National Freight Logistics',
          trackingNumber: 'TRK-2026-TO-001',
          notes: 'Standard distribution rebalancing between Dallas and Atlanta',
          items: [
            {
              product: boltProduct._id,
              requestedQty: 25,
              sourceLocation: sourceBin._id,
            },
          ],
          createdBy: adminUser._id,
        });

        logger.info('Seeded sample transfer order: TO-2026-0001');
      }
    }

    const ruleCount = await ReplenishmentRule.countDocuments();
    if (ruleCount === 0) {
      const mainWarehouse = await Warehouse.findOne({ code: 'WH-MAIN' });
      const boltProduct = await Product.findOne({ sku: 'BOLT-HEX-M8-50' });
      const pickBin =
        (await Location.findOne({
          warehouse: mainWarehouse?._id,
          code: 'RACK-02-S01-B02',
        })) ||
        (await Location.findOne({
          warehouse: mainWarehouse?._id,
          purpose: LOCATION_PURPOSES.PICKING,
          type: LOCATION_TYPES.BIN,
        }));

      if (mainWarehouse && boltProduct && pickBin) {
        await ReplenishmentRule.create({
          warehouse: mainWarehouse._id,
          product: boltProduct._id,
          location: pickBin._id,
          minQuantity: 25,
          maxQuantity: 100,
          isActive: true,
        });

        logger.info(
          `Seeded sample forward pick replenishment rule for ${boltProduct.sku} in bin ${pickBin.code}`,
        );
      }
    }

    logger.info('Master Data seeding completed successfully');
  } catch (error) {
    logger.error('Failed to seed Master Data', { error: error.message });
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

seedMasterData();
