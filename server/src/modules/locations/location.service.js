/**
 * StockPilot WMS - Location domain service.
 *
 * Implements hierarchical physical storage tree operations, materialized path
 * derivation and cascading updates, system location provisioning, and transactional
 * bulk rack/shelf/bin generation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import mongoose from 'mongoose';
import { Location, LOCATION_TYPES, LOCATION_PURPOSES } from './location.model.js';
import { Warehouse } from '../warehouses/warehouse.model.js';
import { ApiError } from '../../utils/ApiError.js';
import { buildPaginationMeta, getSkip } from '../../utils/pagination.js';

const SYSTEM_PURPOSES = Object.freeze([
  LOCATION_PURPOSES.RECEIVING,
  LOCATION_PURPOSES.QUARANTINE,
  LOCATION_PURPOSES.SHIPPING,
  LOCATION_PURPOSES.DAMAGED,
  LOCATION_PURPOSES.RETURNS,
]);

/**
 * Validates that parent-child relationships conform to strict hierarchy rules.
 *
 * @param {string} type - Location type being placed.
 * @param {object|null} parent - Parent location document.
 * @param {string|mongoose.Types.ObjectId} warehouseId - Target warehouse identifier.
 * @returns {void}
 * @throws {ApiError} If hierarchy rules or cross-warehouse boundaries are violated.
 */
const validateParentType = (type, parent, warehouseId) => {
  const targetWarehouseStr = warehouseId.toString();

  if (type === LOCATION_TYPES.ZONE) {
    if (parent) {
      throw ApiError.unprocessable('A ZONE is a top-level location and cannot have a parent');
    }
    return;
  }

  if (!parent) {
    throw ApiError.unprocessable(`A location of type ${type} must have a valid parent`);
  }

  if (parent.warehouse.toString() !== targetWarehouseStr) {
    throw ApiError.unprocessable('Parent location belongs to a different warehouse facility');
  }

  if (type === LOCATION_TYPES.RACK && parent.type !== LOCATION_TYPES.ZONE) {
    throw ApiError.unprocessable('A RACK can only be placed directly under a ZONE');
  }

  if (type === LOCATION_TYPES.SHELF && parent.type !== LOCATION_TYPES.RACK) {
    throw ApiError.unprocessable('A SHELF can only be placed directly under a RACK');
  }

  if (type === LOCATION_TYPES.BIN && parent.type !== LOCATION_TYPES.SHELF) {
    throw ApiError.unprocessable('A BIN can only be placed directly under a SHELF');
  }
};

/**
 * Ensures a warehouse has all standard system locations provisioned.
 *
 * @param {string|mongoose.Types.ObjectId} warehouseId - Warehouse identifier.
 * @param {mongoose.ClientSession|null} [session=null] - Optional transaction session.
 * @returns {Promise<Array<object>>} Provisioned system location documents.
 */
export const ensureSystemLocations = async (warehouseId, session = null) => {
  const warehouse = await Warehouse.findById(warehouseId).session(session);
  if (!warehouse) {
    throw ApiError.notFound('Warehouse not found');
  }

  const created = [];
  for (const purpose of SYSTEM_PURPOSES) {
    const code = `${purpose}`;
    const existing = await Location.findOne({
      warehouse: warehouseId,
      code,
    }).session(session);

    if (!existing) {
      const doc = await Location.create(
        [
          {
            warehouse: warehouseId,
            parent: null,
            type: LOCATION_TYPES.ZONE,
            purpose,
            code,
            path: code,
            isSystem: true,
            isActive: true,
          },
        ],
        { session },
      );
      created.push(doc[0]);
    }
  }

  return created;
};

/**
 * Creates a single location with validated hierarchy and materialized path.
 *
 * @param {object} payload - Validated creation payload.
 * @returns {Promise<object>} Created location document.
 * @throws {ApiError} On hierarchy mismatch, duplicate code, or invalid warehouse.
 */
export const createLocation = async (payload) => {
  const warehouse = await Warehouse.findById(payload.warehouse);
  if (!warehouse) {
    throw ApiError.notFound('Warehouse facility not found');
  }

  if (payload.type === LOCATION_TYPES.ZONE && payload.parent) {
    throw ApiError.unprocessable('A ZONE is a top-level location and cannot have a parent');
  }

  let parent = null;
  if (payload.parent) {
    parent = await Location.findById(payload.parent);
    if (!parent) {
      throw ApiError.notFound('Parent location not found');
    }
  }

  validateParentType(payload.type, parent, payload.warehouse);

  const existing = await Location.findOne({
    warehouse: payload.warehouse,
    code: payload.code,
  });
  if (existing) {
    throw ApiError.conflict(`Location code "${payload.code}" already exists in this warehouse`);
  }

  const path = parent ? `${parent.path}/${payload.code}` : payload.code;

  const location = await Location.create({
    warehouse: payload.warehouse,
    parent: parent ? parent._id : null,
    type: payload.type,
    purpose: payload.purpose || (parent ? parent.purpose : LOCATION_PURPOSES.STORAGE),
    code: payload.code,
    path,
    capacity: payload.capacity || null,
    allowedCategories: payload.allowedCategories || [],
    isSystem: false,
    isActive: true,
  });

  return location;
};

/**
 * Updates an existing location with descendant path recalculation when code or parent moves.
 *
 * @param {string} id - Location identifier.
 * @param {object} payload - Validated update fields.
 * @returns {Promise<object>} Updated location.
 * @throws {ApiError} If not found, moving system locations, or cycle detected.
 */
export const updateLocation = async (id, payload) => {
  const location = await Location.findById(id);
  if (!location) {
    throw ApiError.notFound('Location not found');
  }

  if (location.isSystem) {
    if (payload.purpose && payload.purpose !== location.purpose) {
      throw ApiError.forbidden('Cannot modify the purpose of a system location');
    }
    if (payload.parent !== undefined) {
      throw ApiError.forbidden('Cannot move or reparent a system location');
    }
    if (payload.isActive === false) {
      throw ApiError.forbidden('Cannot deactivate a system location');
    }
  }

  if (payload.isActive === false && location.isActive) {
    const activeChildren = await Location.findOne({
      warehouse: location.warehouse,
      parent: location._id,
      isActive: true,
    });
    if (activeChildren) {
      throw ApiError.conflict('Cannot deactivate location that contains active child locations');
    }
  }

  const oldPath = location.path;
  let codeChanged = false;
  let parentChanged = false;

  if (payload.code && payload.code !== location.code) {
    const duplicate = await Location.findOne({
      warehouse: location.warehouse,
      code: payload.code,
      _id: { $ne: location._id },
    });
    if (duplicate) {
      throw ApiError.conflict(`Location code "${payload.code}" already exists in this warehouse`);
    }
    location.code = payload.code;
    codeChanged = true;
  }

  let parentDoc = null;
  if (payload.parent !== undefined) {
    if (payload.parent) {
      if (payload.parent === id) {
        throw ApiError.unprocessable('A location cannot be its own parent');
      }
      parentDoc = await Location.findById(payload.parent);
      if (!parentDoc) {
        throw ApiError.notFound('Target parent location not found');
      }
      if (parentDoc.path.startsWith(`${oldPath}/`)) {
        throw ApiError.unprocessable('Cannot set a descendant location as the parent');
      }
    }
    validateParentType(location.type, parentDoc, location.warehouse);
    location.parent = parentDoc ? parentDoc._id : null;
    parentChanged = true;
  } else if (location.parent) {
    parentDoc = await Location.findById(location.parent);
  }

  if (codeChanged || parentChanged) {
    const newPath = parentDoc ? `${parentDoc.path}/${location.code}` : location.code;
    location.path = newPath;

    const descendants = await Location.find({
      warehouse: location.warehouse,
      path: new RegExp(`^${oldPath}/`),
    });

    for (const desc of descendants) {
      desc.path = desc.path.replace(new RegExp(`^${oldPath}(/|$)`), `${newPath}$1`);
      await desc.save();
    }
  }

  if (payload.purpose) {
    location.purpose = payload.purpose;
  }
  if (payload.capacity !== undefined) {
    location.capacity = payload.capacity;
  }
  if (payload.allowedCategories !== undefined) {
    location.allowedCategories = payload.allowedCategories;
  }
  if (payload.isActive !== undefined) {
    location.isActive = payload.isActive;
  }

  await location.save();
  return location;
};

/**
 * Deactivates a location after verifying it has no active child locations.
 *
 * @param {string} id - Location identifier.
 * @returns {Promise<object>} Deactivated location document.
 * @throws {ApiError} If not found, is a system location, or has active children.
 */
export const deactivateLocation = async (id) => {
  const location = await Location.findById(id);
  if (!location) {
    throw ApiError.notFound('Location not found');
  }

  if (location.isSystem) {
    throw ApiError.forbidden('System locations cannot be deactivated');
  }

  const activeChildren = await Location.findOne({
    warehouse: location.warehouse,
    parent: location._id,
    isActive: true,
  });
  if (activeChildren) {
    throw ApiError.conflict('Cannot deactivate location that contains active child locations');
  }

  location.isActive = false;
  await location.save();
  return location;
};

/**
 * Bulk creates a Rack with child Shelves and Bins in an atomic transaction.
 *
 * @param {object} payload - Bulk parameters.
 * @returns {Promise<object>} Summary of created locations.
 * @throws {ApiError} If zone invalid or rack code exists.
 */
export const bulkCreateLocations = async (payload) => {
  const { warehouse, zone: zoneId, rackCode, purpose, shelvesCount, binsPerShelf } = payload;

  const warehouseDoc = await Warehouse.findById(warehouse);
  if (!warehouseDoc) {
    throw ApiError.notFound('Warehouse not found');
  }

  const zoneDoc = await Location.findOne({
    _id: zoneId,
    warehouse,
    type: LOCATION_TYPES.ZONE,
  });
  if (!zoneDoc) {
    throw ApiError.unprocessable('Selected parent zone does not exist in this warehouse');
  }

  const existingRack = await Location.findOne({
    warehouse,
    code: rackCode,
  });
  if (existingRack) {
    throw ApiError.conflict(`Location code "${rackCode}" already exists in this warehouse`);
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const rackPath = `${zoneDoc.path}/${rackCode}`;
      const [rack] = await Location.create(
        [
          {
            warehouse,
            parent: zoneDoc._id,
            type: LOCATION_TYPES.RACK,
            purpose,
            code: rackCode,
            path: rackPath,
            isSystem: false,
            isActive: true,
          },
        ],
        { session },
      );

      let shelvesCreated = 0;
      let binsCreated = 0;

      for (let s = 1; s <= shelvesCount; s += 1) {
        const shelfCode = `${rackCode}-S${String(s).padStart(2, '0')}`;
        const shelfPath = `${rackPath}/S${String(s).padStart(2, '0')}`;

        const [shelf] = await Location.create(
          [
            {
              warehouse,
              parent: rack._id,
              type: LOCATION_TYPES.SHELF,
              purpose,
              code: shelfCode,
              path: shelfPath,
              isSystem: false,
              isActive: true,
            },
          ],
          { session },
        );
        shelvesCreated += 1;

        const binDocsToInsert = [];
        for (let b = 1; b <= binsPerShelf; b += 1) {
          const binCode = `${shelfCode}-B${String(b).padStart(2, '0')}`;
          const binPath = `${shelfPath}/B${String(b).padStart(2, '0')}`;

          binDocsToInsert.push({
            warehouse,
            parent: shelf._id,
            type: LOCATION_TYPES.BIN,
            purpose,
            code: binCode,
            path: binPath,
            isSystem: false,
            isActive: true,
          });
        }

        await Location.insertMany(binDocsToInsert, { session });
        binsCreated += binDocsToInsert.length;
      }

      result = {
        rack,
        shelvesCreated,
        binsCreated,
        totalCreated: 1 + shelvesCreated + binsCreated,
      };
    });

    return result;
  } finally {
    await session.endSession();
  }
};

/**
 * Builds an expandable hierarchical tree of warehouse locations.
 *
 * @param {string} warehouseId - Warehouse identifier.
 * @returns {Promise<Array<object>>} Hierarchical root locations with nested children.
 */
export const getLocationTree = async (warehouseId) => {
  const warehouse = await Warehouse.findById(warehouseId);
  if (!warehouse) {
    throw ApiError.notFound('Warehouse not found');
  }

  const locations = await Location.find({ warehouse: warehouseId }).sort({ path: 1 }).lean();

  const nodeMap = new Map();
  for (const loc of locations) {
    nodeMap.set(loc._id.toString(), {
      ...loc,
      id: loc._id.toString(),
      children: [],
    });
  }

  const roots = [];
  for (const loc of locations) {
    const node = nodeMap.get(loc._id.toString());
    if (loc.parent) {
      const parentNode = nodeMap.get(loc.parent.toString());
      if (parentNode) {
        parentNode.children.push(node);
      } else {
        roots.push(node);
      }
    } else {
      roots.push(node);
    }
  }

  return roots;
};

/**
 * Retrieves a single location by its identifier.
 *
 * @param {string} id - Location identifier.
 * @returns {Promise<object>} Location document with populated references.
 */
export const getLocationById = async (id) => {
  const location = await Location.findById(id)
    .populate('warehouse', 'code name')
    .populate('parent', 'code name path type')
    .populate('allowedCategories', 'name');

  if (!location) {
    throw ApiError.notFound('Location not found');
  }

  return location;
};

/**
 * Lists locations matching search filters with pagination.
 *
 * @param {object} query - Query filters.
 * @returns {Promise<{items: Array<object>, meta: object}>} Paginated location items and metadata.
 */
export const listLocations = async (query) => {
  const filter = {};

  if (query.warehouse) {
    filter.warehouse = query.warehouse;
  }
  if (query.type) {
    filter.type = query.type;
  }
  if (query.purpose) {
    filter.purpose = query.purpose;
  }
  if (query.parent !== undefined) {
    filter.parent = query.parent;
  }
  if (typeof query.isActive === 'boolean') {
    filter.isActive = query.isActive;
  }
  if (query.search) {
    filter.$or = [
      { code: { $regex: query.search, $options: 'i' } },
      { path: { $regex: query.search, $options: 'i' } },
    ];
  }

  const [items, total] = await Promise.all([
    Location.find(filter)
      .sort({ path: 1 })
      .skip(getSkip(query.page, query.limit))
      .limit(query.limit)
      .populate('parent', 'code path type'),
    Location.countDocuments(filter),
  ]);

  return { items, meta: buildPaginationMeta({ page: query.page, limit: query.limit, total }) };
};
