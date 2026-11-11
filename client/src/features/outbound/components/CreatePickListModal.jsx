/**
 * StockPilot WMS - Wave / Pick List Creation Modal.
 *
 * Allows warehouse supervisors to combine multiple confirmed or allocated
 * sales orders into an optimized wave picking batch.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, AlertCircle } from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import { fetchUsers } from '@/features/users/usersApi.js';
import { fetchSalesOrders } from '../salesOrdersApi.js';
import { createPickList } from '../pickingApi.js';

/**
 * Inner form component for pick wave generation.
 *
 * @param {object} props - Component properties.
 * @param {object|null} [props.initialOrder=null] - Preselected order to initiate wave.
 * @param {Function} props.onClose - Modal dismissal callback.
 * @param {Function} [props.onCreated] - Callback on wave creation.
 * @returns {JSX.Element}
 */
const CreatePickListForm = ({ initialOrder = null, onClose, onCreated }) => {
  const queryClient = useQueryClient();

  const initialWhId =
    initialOrder?.warehouse?._id ||
    initialOrder?.warehouse?.id ||
    initialOrder?.warehouse ||
    '';
  const initialOrdId = initialOrder?._id || initialOrder?.id;

  const [warehouseId, setWarehouseId] = useState(initialWhId);
  const [selectedOrderIds, setSelectedOrderIds] = useState(
    initialOrdId ? [initialOrdId] : [],
  );
  const [stagingLocationId, setStagingLocationId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [actionError, setActionError] = useState(null);

  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100, isActive: 'true' }),
  });

  const { data: locationsData } = useQuery({
    queryKey: ['locations-staging', warehouseId],
    queryFn: () => fetchLocations({ warehouse: warehouseId, limit: 100 }),
    enabled: Boolean(warehouseId),
  });

  const { data: usersData } = useQuery({
    queryKey: ['pickers-list'],
    queryFn: () => fetchUsers({ limit: 100, isActive: 'true' }),
  });

  const { data: ordersData, isLoading: isLoadingOrders } = useQuery({
    queryKey: ['sales-orders-pickable', warehouseId],
    queryFn: () => fetchSalesOrders({ warehouse: warehouseId, limit: 50 }),
    enabled: Boolean(warehouseId),
  });

  const warehouses = warehousesData?.items || [];
  const locations = locationsData?.items || [];
  const users = usersData?.items || [];

  const eligibleOrders = (ordersData?.items || []).filter(
    (order) => order.status === 'CONFIRMED' || order.status === 'ALLOCATED',
  );

  const stagingLocations = locations.filter(
    (loc) =>
      loc.purpose === 'STAGING' ||
      loc.purpose === 'DOCK' ||
      loc.type === 'BIN',
  );

  const createMutation = useMutation({
    mutationFn: (payload) => createPickList(payload),
    onSuccess: (newPickList) => {
      queryClient.invalidateQueries({ queryKey: ['pick-lists'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      onClose();
      if (onCreated) onCreated(newPickList);
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to generate pick list',
      );
    },
  });

  const toggleOrderSelection = (id) => {
    setSelectedOrderIds((prev) =>
      prev.includes(id) ? prev.filter((oId) => oId !== id) : [...prev, id],
    );
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    if (!warehouseId) {
      setActionError('Please select a warehouse');
      return;
    }

    if (selectedOrderIds.length === 0) {
      setActionError('Please select at least one sales order for this pick wave');
      return;
    }

    createMutation.mutate({
      warehouse: warehouseId,
      salesOrderIds: selectedOrderIds,
      stagingLocationId: stagingLocationId || undefined,
      assignedTo: assignedTo || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {actionError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Warehouse"
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setSelectedOrderIds([]);
            setStagingLocationId('');
          }}
          required
          options={[
            { value: '', label: '-- Select Warehouse --' },
            ...warehouses.map((w) => ({
              value: w.id || w._id,
              label: `${w.name} (${w.code})`,
            })),
          ]}
        />

        <Select
          label="Assigned Picker (Optional)"
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
          options={[
            { value: '', label: '-- Unassigned (Any operator) --' },
            ...users.map((u) => ({
              value: u.id || u._id,
              label: `${u.name} (${u.role})`,
            })),
          ]}
        />
      </div>

      <div>
        <Select
          label="Outbound Staging Location (Optional)"
          value={stagingLocationId}
          onChange={(e) => setStagingLocationId(e.target.value)}
          options={[
            { value: '', label: '-- Auto-assign Default Staging Location --' },
            ...stagingLocations.map((loc) => ({
              value: loc.id || loc._id,
              label: `${loc.path || loc.code} (${loc.purpose || loc.type})`,
            })),
          ]}
        />
        <p className="mt-1 text-xs text-slate-500">
          Designate the staging dock or sorting station where picked items will be deposited.
        </p>
      </div>

      {/* Sales Orders Multi-Select Table */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Select Orders to Include in Wave ({selectedOrderIds.length} selected)
          </label>
          {eligibleOrders.length > 0 && (
            <button
              type="button"
              onClick={() => {
                if (selectedOrderIds.length === eligibleOrders.length) {
                  setSelectedOrderIds([]);
                } else {
                  setSelectedOrderIds(eligibleOrders.map((o) => o._id || o.id));
                }
              }}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
            >
              {selectedOrderIds.length === eligibleOrders.length
                ? 'Deselect All'
                : 'Select All Eligible'}
            </button>
          )}
        </div>

        {!warehouseId ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            Select a warehouse to view eligible sales orders ready for wave picking.
          </div>
        ) : isLoadingOrders ? (
          <div className="p-6 text-center text-sm text-slate-500">Loading orders...</div>
        ) : eligibleOrders.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
            No confirmed or allocated sales orders currently pending picking for this warehouse.
          </div>
        ) : (
          <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
              <thead className="bg-slate-50 sticky top-0 font-medium text-slate-600">
                <tr>
                  <th className="w-10 px-3 py-2 text-center">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="px-3 py-2">Order #</th>
                  <th className="px-3 py-2">Customer</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Items</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {eligibleOrders.map((ord) => {
                  const id = ord._id || ord.id;
                  const isChecked = selectedOrderIds.includes(id);
                  return (
                    <tr
                      key={id}
                      onClick={() => toggleOrderSelection(id)}
                      className={`cursor-pointer transition-colors ${
                        isChecked ? 'bg-indigo-50/60' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-3 py-2 font-mono font-semibold text-slate-900">
                        {ord.soNumber}
                      </td>
                      <td className="px-3 py-2 text-slate-700">
                        {ord.customer?.name || 'Customer'}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={ord.status === 'ALLOCATED' ? 'warning' : 'info'}>
                          {ord.status}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right font-medium text-slate-700">
                        {ord.items?.length || 0} lines
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          isLoading={createMutation.isPending}
          disabled={selectedOrderIds.length === 0}
        >
          <CheckSquare className="h-4 w-4 mr-1.5" />
          Generate Pick Wave
        </Button>
      </div>
    </form>
  );
};

/**
 * Wave Pick List Creation Modal wrapper.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is displayed.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object|null} [props.initialOrder=null] - Preselected order to initiate wave.
 * @param {Function} [props.onCreated] - Callback on successful pick list creation.
 * @returns {JSX.Element|null}
 */
export const CreatePickListModal = ({
  isOpen,
  onClose,
  initialOrder = null,
  onCreated,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Wave Pick List"
      size="xl"
    >
      <CreatePickListForm
        initialOrder={initialOrder}
        onClose={onClose}
        onCreated={onCreated}
      />
    </Modal>
  );
};

export default CreatePickListModal;
