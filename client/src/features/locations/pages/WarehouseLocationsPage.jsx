/**
 * StockPilot WMS - Warehouse location tree and management page.
 *
 * Provides an interactive hierarchical tree viewer (Zone -> Rack -> Shelf -> Bin),
 * flat searchable tabular inventory location index, single location creation,
 * and transactional bulk rack/shelf/bin generation.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Plus,
  Search,
  Edit2,
  AlertCircle,
  FolderTree,
  List,
  ChevronRight,
  ChevronDown,
  Layers,
  Columns,
  Grid,
  Box,
  Wand2,
  Shield,
  Building,
} from 'lucide-react';
import {
  fetchLocations,
  fetchLocationTree,
  createLocation,
  updateLocation,
  deactivateLocation,
  bulkCreateLocations,
} from '../locationsApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import Modal from '@/components/ui/Modal.jsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog.jsx';
import DataTable from '@/components/ui/DataTable.jsx';

const singleLocationSchema = z.object({
  type: z.enum(['ZONE', 'RACK', 'SHELF', 'BIN']),
  parent: z.string().nullable().optional(),
  code: z
    .string()
    .trim()
    .min(1, 'Code is required')
    .max(50)
    .transform((val) => val.toUpperCase()),
  purpose: z.enum([
    'RECEIVING',
    'QUARANTINE',
    'STORAGE',
    'PICKING',
    'SHIPPING',
    'DAMAGED',
    'RETURNS',
  ]),
  maxQuantity: z.coerce.number().min(0).optional().nullable(),
  maxWeightKg: z.coerce.number().min(0).optional().nullable(),
});

const bulkGeneratorSchema = z.object({
  zone: z.string().min(1, 'Parent zone is required'),
  rackCode: z
    .string()
    .trim()
    .min(1, 'Rack code is required')
    .max(20)
    .transform((val) => val.toUpperCase()),
  purpose: z.enum([
    'RECEIVING',
    'QUARANTINE',
    'STORAGE',
    'PICKING',
    'SHIPPING',
    'DAMAGED',
    'RETURNS',
  ]),
  shelvesCount: z.coerce.number().int().min(1, 'Must be at least 1').max(50),
  binsPerShelf: z.coerce.number().int().min(1, 'Must be at least 1').max(50),
});

/**
 * Renders an expandable tree node representing a physical storage location.
 *
 * @param {object} props - Component properties.
 * @param {object} props.node - Location tree node with nested children.
 * @param {boolean} props.canWrite - Edit permissions flag.
 * @param {Function} props.onAddChild - Add child handler.
 * @param {Function} props.onEdit - Edit node handler.
 * @param {Function} props.onDeactivate - Deactivate handler.
 * @returns {JSX.Element} Node element.
 */
const LocationTreeNode = ({ node, canWrite, onAddChild, onEdit, onDeactivate }) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const purposeBadges = {
    RECEIVING: 'info',
    QUARANTINE: 'warning',
    STORAGE: 'neutral',
    PICKING: 'indigo',
    SHIPPING: 'info',
    DAMAGED: 'danger',
    RETURNS: 'warning',
  };

  const typeIcons = {
    ZONE: <Layers className="h-4 w-4 text-indigo-600" />,
    RACK: <Columns className="h-4 w-4 text-sky-600" />,
    SHELF: <Grid className="h-4 w-4 text-amber-600" />,
    BIN: <Box className="h-4 w-4 text-emerald-600" />,
  };

  const nextChildType = {
    ZONE: 'RACK',
    RACK: 'SHELF',
    SHELF: 'BIN',
  };

  return (
    <div className="border-l border-slate-200 pl-4 py-1">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-xs hover:border-slate-300">
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-5" />
          )}

          <div className="flex items-center gap-1.5">
            {typeIcons[node.type] || <Box className="h-4 w-4 text-slate-400" />}
            <span className="font-mono font-bold text-slate-900">{node.code}</span>
          </div>

          <span className="text-xs text-slate-400 font-mono hidden sm:inline">({node.path})</span>

          <div className="flex items-center gap-1.5 ml-2">
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 uppercase">
              {node.type}
            </span>
            <Badge variant={purposeBadges[node.purpose] || 'neutral'}>{node.purpose}</Badge>
            {node.isSystem && (
              <span
                title="System Location"
                className="inline-flex items-center gap-1 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200"
              >
                <Shield className="h-3 w-3" />
                System
              </span>
            )}
            {!node.isActive && <Badge variant="danger">Inactive</Badge>}
          </div>
        </div>

        {canWrite && (
          <div className="flex items-center gap-1">
            {nextChildType[node.type] && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onAddChild(node, nextChildType[node.type])}
                title={`Add ${nextChildType[node.type]} under ${node.code}`}
                aria-label={`Add child to ${node.code}`}
              >
                <Plus className="h-3.5 w-3.5 text-indigo-600 mr-1" />
                <span className="text-xs">{nextChildType[node.type]}</span>
              </Button>
            )}
            {!node.isSystem && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(node)}
                  aria-label={`Edit ${node.code}`}
                >
                  <Edit2 className="h-3.5 w-3.5" />
                </Button>
                {node.isActive && !hasChildren && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs"
                    onClick={() => onDeactivate(node)}
                  >
                    Deactivate
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1 mt-1">
          {node.children.map((child) => (
            <LocationTreeNode
              key={child.id || child._id}
              node={child}
              canWrite={canWrite}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDeactivate={onDeactivate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Renders the primary warehouse locations page with tree and tabular views.
 *
 * @returns {JSX.Element} Warehouse locations page.
 */
const WarehouseLocationsPage = () => {
  const { warehouseId: routeWarehouseId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { can: userCan } = useAuth();
  const canWrite = userCan(PERMISSIONS.WAREHOUSES_WRITE);

  const [activeTab, setActiveTab] = useState('tree');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [purposeFilter, setPurposeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [isSingleModalOpen, setIsSingleModalOpen] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [deactivatingLocation, setDeactivatingLocation] = useState(null);
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-lookup'],
    queryFn: () => fetchWarehouses({ limit: 50, isActive: 'true' }),
  });

  const warehouses = warehousesData?.items || [];
  const selectedWarehouseId = routeWarehouseId || (warehouses.length > 0 ? warehouses[0].id : '');

  const activeWarehouse = warehouses.find((w) => w.id === selectedWarehouseId);

  const {
    data: treeData,
    isLoading: isTreeLoading,
    error: treeError,
  } = useQuery({
    queryKey: ['location-tree', selectedWarehouseId],
    queryFn: () => fetchLocationTree(selectedWarehouseId),
    enabled: Boolean(selectedWarehouseId),
  });

  const { data: flatData, isLoading: isFlatLoading } = useQuery({
    queryKey: [
      'locations-flat',
      { warehouse: selectedWarehouseId, search, type: typeFilter, purpose: purposeFilter, page },
    ],
    queryFn: () =>
      fetchLocations({
        warehouse: selectedWarehouseId,
        search: search || undefined,
        type: typeFilter || undefined,
        purpose: purposeFilter || undefined,
        page,
        limit: 15,
      }),
    enabled: Boolean(selectedWarehouseId) && activeTab === 'flat',
  });

  const { data: candidateParentsData } = useQuery({
    queryKey: ['locations-all-for-parent', selectedWarehouseId],
    queryFn: () => fetchLocations({ warehouse: selectedWarehouseId, limit: 100, isActive: 'true' }),
    enabled: Boolean(selectedWarehouseId),
  });

  const candidateParents = candidateParentsData?.items || [];

  const [singleLocationType, setSingleLocationType] = useState('ZONE');
  const [bulkShelves, setBulkShelves] = useState(3);
  const [bulkBins, setBulkBins] = useState(4);

  const {
    register: registerSingle,
    handleSubmit: handleSubmitSingle,
    reset: resetSingle,
    setValue: setValueSingle,
    formState: { errors: singleErrors, isSubmitting: isSingleSubmitting },
  } = useForm({
    resolver: zodResolver(singleLocationSchema),
    defaultValues: {
      type: 'ZONE',
      parent: '',
      code: '',
      purpose: 'STORAGE',
      maxQuantity: null,
      maxWeightKg: null,
    },
  });

  const {
    register: registerBulk,
    handleSubmit: handleSubmitBulk,
    reset: resetBulk,
    formState: { errors: bulkErrors, isSubmitting: isBulkSubmitting },
  } = useForm({
    resolver: zodResolver(bulkGeneratorSchema),
    defaultValues: {
      zone: '',
      rackCode: 'RACK-01',
      purpose: 'STORAGE',
      shelvesCount: 3,
      binsPerShelf: 4,
    },
  });

  const bulkPreviewTotal = 1 + Number(bulkShelves) + Number(bulkShelves) * Number(bulkBins);

  const createMutation = useMutation({
    mutationFn: (payload) => createLocation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all-for-parent'] });
      setIsSingleModalOpen(false);
      resetSingle();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to create location',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updateLocation(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all-for-parent'] });
      setIsSingleModalOpen(false);
      setEditingLocation(null);
      resetSingle();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to update location',
      );
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: (id) => deactivateLocation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all-for-parent'] });
      setDeactivatingLocation(null);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message ||
          err.message ||
          'Failed to deactivate location. Ensure no active child locations or stock balances remain.',
      );
      setDeactivatingLocation(null);
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (payload) => bulkCreateLocations(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['location-tree'] });
      queryClient.invalidateQueries({ queryKey: ['locations-flat'] });
      queryClient.invalidateQueries({ queryKey: ['locations-all-for-parent'] });
      setIsBulkModalOpen(false);
      resetBulk();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to bulk generate locations',
      );
    },
  });

  const handleWarehouseChange = (e) => {
    const newId = e.target.value;
    navigate(`/warehouses/${newId}/locations`);
  };

  const openCreateModal = () => {
    setActionError(null);
    setEditingLocation(null);
    setSingleLocationType('ZONE');
    resetSingle({
      type: 'ZONE',
      parent: '',
      code: '',
      purpose: 'STORAGE',
      maxQuantity: null,
      maxWeightKg: null,
    });
    setIsSingleModalOpen(true);
  };

  const openAddChildModal = (parentNode, childType) => {
    setActionError(null);
    setEditingLocation(null);
    setSingleLocationType(childType);
    resetSingle({
      type: childType,
      parent: parentNode.id || parentNode._id,
      code: '',
      purpose: parentNode.purpose || 'STORAGE',
      maxQuantity: null,
      maxWeightKg: null,
    });
    setIsSingleModalOpen(true);
  };

  const openEditModal = (loc) => {
    setActionError(null);
    setEditingLocation(loc);
    setSingleLocationType(loc.type);
    resetSingle({
      type: loc.type,
      parent: loc.parent ? loc.parent.id || loc.parent._id || loc.parent : '',
      code: loc.code,
      purpose: loc.purpose,
      maxQuantity: loc.capacity?.maxQuantity ?? null,
      maxWeightKg: loc.capacity?.maxWeightKg ?? null,
    });
    setIsSingleModalOpen(true);
  };

  const openBulkModal = () => {
    setActionError(null);
    const firstZone = candidateParents.find((l) => l.type === 'ZONE');
    setBulkShelves(3);
    setBulkBins(4);
    resetBulk({
      zone: firstZone ? firstZone.id : '',
      rackCode: 'RACK-01',
      purpose: 'STORAGE',
      shelvesCount: 3,
      binsPerShelf: 4,
    });
    setIsBulkModalOpen(true);
  };

  const onSubmitSingle = async (values) => {
    setActionError(null);
    const payload = {
      warehouse: selectedWarehouseId,
      type: values.type,
      parent: values.type === 'ZONE' ? null : values.parent || null,
      code: values.code,
      purpose: values.purpose,
      capacity:
        values.maxQuantity || values.maxWeightKg
          ? {
              maxQuantity: values.maxQuantity ? Number(values.maxQuantity) : null,
              maxWeightKg: values.maxWeightKg ? Number(values.maxWeightKg) : null,
            }
          : null,
    };

    if (editingLocation) {
      await updateMutation.mutateAsync({
        id: editingLocation.id || editingLocation._id,
        payload: {
          code: payload.code,
          purpose: payload.purpose,
          capacity: payload.capacity,
        },
      });
    } else {
      await createMutation.mutateAsync(payload);
    }
  };

  const onSubmitBulk = async (values) => {
    setActionError(null);
    await bulkMutation.mutateAsync({
      warehouse: selectedWarehouseId,
      zone: values.zone,
      rackCode: values.rackCode,
      purpose: values.purpose,
      shelvesCount: Number(values.shelvesCount),
      binsPerShelf: Number(values.binsPerShelf),
    });
  };

  const eligibleParents = candidateParents.filter((l) => {
    if (singleLocationType === 'ZONE') return false;
    if (singleLocationType === 'RACK') return l.type === 'ZONE';
    if (singleLocationType === 'SHELF') return l.type === 'RACK';
    if (singleLocationType === 'BIN') return l.type === 'SHELF';
    return false;
  });

  const columns = [
    {
      header: 'Code & Materialized Path',
      key: 'path',
      render: (row) => (
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded text-xs">
              {row.code}
            </span>
            <span className="font-mono text-xs text-slate-500">{row.path}</span>
          </div>
        </div>
      ),
    },
    {
      header: 'Type',
      key: 'type',
      render: (row) => (
        <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
          {row.type}
        </span>
      ),
    },
    {
      header: 'Purpose',
      key: 'purpose',
      render: (row) => <Badge>{row.purpose}</Badge>,
    },
    {
      header: 'System',
      key: 'isSystem',
      render: (row) =>
        row.isSystem ? (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
            <Shield className="h-3 w-3" />
            System
          </span>
        ) : (
          <span className="text-slate-400 text-xs">Standard</span>
        ),
    },
    {
      header: 'Status',
      key: 'isActive',
      render: (row) => (
        <Badge variant={row.isActive ? 'success' : 'danger'}>
          {row.isActive ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
    ...(canWrite
      ? [
          {
            header: 'Actions',
            key: 'actions',
            className: 'text-right',
            render: (row) =>
              !row.isSystem ? (
                <div className="flex items-center justify-end gap-1.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditModal(row)}
                    aria-label={`Edit ${row.code}`}
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  {row.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                      onClick={() => setDeactivatingLocation(row)}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              ) : null,
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Warehouse Locations &amp; Structure
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Model physical facility storage topography: Zones, Racks, Shelves, and Bins with
            materialized paths.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canWrite && (
            <>
              <Button variant="secondary" onClick={openBulkModal}>
                <Wand2 className="h-4 w-4 mr-1.5 text-indigo-600" />
                Bulk Rack Generator
              </Button>
              <Button onClick={openCreateModal}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Location
              </Button>
            </>
          )}
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{actionError}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-indigo-600 shrink-0" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500">Warehouse:</span>
            <select
              value={selectedWarehouseId}
              onChange={handleWarehouseChange}
              className="rounded-lg border border-slate-300 py-1.5 px-3 text-sm font-semibold text-slate-900 bg-white focus:border-indigo-600 focus:outline-none"
            >
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>
          {activeWarehouse && (
            <span className="text-xs text-slate-500 hidden md:inline">
              {[activeWarehouse.address?.city, activeWarehouse.address?.country]
                .filter(Boolean)
                .join(', ')}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
          <button
            type="button"
            onClick={() => setActiveTab('tree')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'tree'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FolderTree className="h-3.5 w-3.5" />
            Hierarchical Tree
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('flat')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'flat'
                ? 'bg-white text-indigo-600 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Flat Table Index
          </button>
        </div>
      </div>

      {activeTab === 'tree' && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Physical Location Tree</h2>
              <p className="text-xs text-slate-500">
                Expand zones to inspect racks, shelves, and storage bins.
              </p>
            </div>
          </div>

          {isTreeLoading && (
            <div className="py-12 text-center text-sm text-slate-500">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mr-2" />
              Loading location tree...
            </div>
          )}

          {treeError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load location tree: {treeError.message}
            </div>
          )}

          {!isTreeLoading && !treeError && treeData && treeData.length === 0 && (
            <div className="py-12 text-center text-sm text-slate-500">
              No locations provisioned for this warehouse yet. Click &quot;Add Location&quot; or
              &quot;Bulk Rack Generator&quot; to begin.
            </div>
          )}

          {!isTreeLoading && treeData && treeData.length > 0 && (
            <div className="space-y-2">
              {treeData.map((rootNode) => (
                <LocationTreeNode
                  key={rootNode.id || rootNode._id}
                  node={rootNode}
                  canWrite={canWrite}
                  onAddChild={openAddChildModal}
                  onEdit={openEditModal}
                  onDeactivate={(node) => setDeactivatingLocation(node)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'flat' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative w-full max-w-sm">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search by code or path..."
                className="block w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm placeholder:text-slate-400 focus:border-indigo-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-3">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white text-slate-700 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">All Types</option>
                <option value="ZONE">Zone</option>
                <option value="RACK">Rack</option>
                <option value="SHELF">Shelf</option>
                <option value="BIN">Bin</option>
              </select>

              <select
                value={purposeFilter}
                onChange={(e) => {
                  setPurposeFilter(e.target.value);
                  setPage(1);
                }}
                className="rounded-lg border border-slate-300 py-2 px-3 text-xs bg-white text-slate-700 focus:border-indigo-600 focus:outline-none"
              >
                <option value="">All Purposes</option>
                <option value="STORAGE">Storage</option>
                <option value="RECEIVING">Receiving</option>
                <option value="PICKING">Picking</option>
                <option value="SHIPPING">Shipping</option>
                <option value="QUARANTINE">Quarantine</option>
                <option value="DAMAGED">Damaged</option>
                <option value="RETURNS">Returns</option>
              </select>
            </div>
          </div>

          <DataTable
            columns={columns}
            data={flatData?.items || []}
            isLoading={isFlatLoading}
            emptyMessage="No locations matching your filters."
            pagination={
              flatData?.meta
                ? {
                    page: flatData.meta.page,
                    totalPages: flatData.meta.totalPages,
                    total: flatData.meta.total,
                    onPageChange: (newPage) => setPage(newPage),
                  }
                : null
            }
          />
        </div>
      )}

      <Modal
        isOpen={isSingleModalOpen}
        onClose={() => setIsSingleModalOpen(false)}
        title={editingLocation ? 'Edit Location' : 'Create Location'}
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmitSingle(onSubmitSingle)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Location Type"
              disabled={Boolean(editingLocation)}
              error={singleErrors.type?.message}
              {...registerSingle('type', {
                onChange: (e) => {
                  setSingleLocationType(e.target.value);
                  if (e.target.value === 'ZONE') {
                    setValueSingle('parent', '');
                  }
                },
              })}
            >
              <option value="ZONE">Zone (Top Level)</option>
              <option value="RACK">Rack (under Zone)</option>
              <option value="SHELF">Shelf (under Rack)</option>
              <option value="BIN">Bin (under Shelf)</option>
            </Select>

            <Select
              label="Functional Purpose"
              error={singleErrors.purpose?.message}
              {...registerSingle('purpose')}
            >
              <option value="STORAGE">Storage</option>
              <option value="RECEIVING">Receiving</option>
              <option value="PICKING">Picking</option>
              <option value="SHIPPING">Shipping</option>
              <option value="QUARANTINE">Quarantine</option>
              <option value="DAMAGED">Damaged Goods</option>
              <option value="RETURNS">Customer Returns</option>
            </Select>
          </div>

          {singleLocationType !== 'ZONE' && (
            <Select
              label="Parent Location"
              disabled={Boolean(editingLocation)}
              error={singleErrors.parent?.message}
              {...registerSingle('parent')}
            >
              <option value="">Select Parent Location</option>
              {eligibleParents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.path} ({p.type})
                </option>
              ))}
            </Select>
          )}

          <Input
            label="Location Code"
            placeholder={
              singleLocationType === 'ZONE'
                ? 'e.g. ZONE-C'
                : singleLocationType === 'RACK'
                  ? 'e.g. RACK-03'
                  : singleLocationType === 'SHELF'
                    ? 'e.g. SHELF-01'
                    : 'e.g. BIN-01'
            }
            error={singleErrors.code?.message}
            {...registerSingle('code')}
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Max Quantity Capacity"
              type="number"
              min="0"
              placeholder="Unlimited"
              error={singleErrors.maxQuantity?.message}
              {...registerSingle('maxQuantity')}
            />
            <Input
              label="Max Weight (kg)"
              type="number"
              step="0.1"
              min="0"
              placeholder="Unlimited"
              error={singleErrors.maxWeightKg?.message}
              {...registerSingle('maxWeightKg')}
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsSingleModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSingleSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingLocation ? 'Save Changes' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={isBulkModalOpen}
        onClose={() => setIsBulkModalOpen(false)}
        title="Bulk Rack &amp; Bin Generator"
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleSubmitBulk(onSubmitBulk)} className="space-y-4">
          <p className="text-xs text-slate-600">
            Generate a full Rack with multiple Shelves and Bins in a single atomic transaction.
          </p>

          <Select label="Target Zone" error={bulkErrors.zone?.message} {...registerBulk('zone')}>
            <option value="">Select a Zone</option>
            {candidateParents
              .filter((l) => l.type === 'ZONE')
              .map((z) => (
                <option key={z.id} value={z.id}>
                  {z.code} ({z.purpose})
                </option>
              ))}
          </Select>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Rack Code Prefix"
              placeholder="e.g. RACK-03"
              error={bulkErrors.rackCode?.message}
              {...registerBulk('rackCode')}
            />

            <Select
              label="Purpose"
              error={bulkErrors.purpose?.message}
              {...registerBulk('purpose')}
            >
              <option value="STORAGE">Storage</option>
              <option value="PICKING">Picking</option>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Number of Shelves"
              type="number"
              min="1"
              max="50"
              error={bulkErrors.shelvesCount?.message}
              {...registerBulk('shelvesCount', {
                onChange: (e) => setBulkShelves(Number(e.target.value) || 0),
              })}
            />

            <Input
              label="Bins per Shelf"
              type="number"
              min="1"
              max="50"
              error={bulkErrors.binsPerShelf?.message}
              {...registerBulk('binsPerShelf', {
                onChange: (e) => setBulkBins(Number(e.target.value) || 0),
              })}
            />
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900">
            <span className="font-bold">Transaction Preview:</span>
            <p className="mt-0.5">
              Will generate 1 Rack, {bulkShelves} Shelves, and{' '}
              {Number(bulkShelves) * Number(bulkBins)} Bins (total of{' '}
              <span className="font-bold">{bulkPreviewTotal}</span> new physical storage locations).
            </p>
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={() => setIsBulkModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isBulkSubmitting || bulkMutation.isPending}>
              Generate Rack &amp; Bins
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deactivatingLocation)}
        onClose={() => setDeactivatingLocation(null)}
        onConfirm={() =>
          deactivatingLocation &&
          deactivateMutation.mutate(deactivatingLocation.id || deactivatingLocation._id)
        }
        title="Deactivate Location"
        message={`Are you sure you want to deactivate location "${deactivatingLocation?.code}" (${deactivatingLocation?.path})? You cannot deactivate it if active children or stock balances exist.`}
        confirmText="Deactivate"
        confirmVariant="danger"
        isLoading={deactivateMutation.isPending}
      />
    </div>
  );
};

export default WarehouseLocationsPage;
