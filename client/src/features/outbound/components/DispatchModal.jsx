/**
 * StockPilot WMS - Outbound Shipment Packaging & Dispatch Modal.
 *
 * Implements carrier selection, tracking number capture, cartonization,
 * and atomic stock dispatch committing SALES_ISSUE to the ledger.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Truck,
  PackageCheck,
  AlertCircle,
  Plus,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import Select from '@/components/ui/Select.jsx';
import { createShipment, dispatchShipment } from '../shipmentsApi.js';

const COMMON_CARRIERS = [
  'FedEx Express',
  'FedEx Ground',
  'UPS Ground',
  'UPS Next Day Air',
  'DHL Express',
  'USPS Priority',
  'BlueDart Logistics',
  'Freight Forwarder',
  'Local Courier / Fleet',
];

const BOX_TYPES = [
  { value: 'STANDARD_BOX', label: 'Standard Corrugated Box' },
  { value: 'SMALL_BOX', label: 'Small Parcel Box' },
  { value: 'LARGE_BOX', label: 'Large Heavy Box' },
  { value: 'PALLET', label: 'Full Wood Pallet' },
  { value: 'ENVELOPE', label: 'Padded Mailer Envelope' },
];

/**
 * Inner dispatch form component.
 *
 * @param {object} props - Component properties.
 * @param {object|null} [props.salesOrder=null] - Sales order to create and dispatch.
 * @param {object|null} [props.shipment=null] - Existing shipment to dispatch.
 * @param {Function} props.onClose - Dismiss callback.
 * @returns {JSX.Element}
 */
const DispatchForm = ({ salesOrder = null, shipment = null, onClose }) => {
  const queryClient = useQueryClient();

  const initialCarrier = shipment?.carrier || COMMON_CARRIERS[0];
  const initialTracking = shipment?.trackingNumber || '';
  const initialPackages = shipment?.packages?.length
    ? shipment.packages.map((p, idx) => ({
        id: String(idx + 1),
        packageNumber: p.packageNumber || `PKG-${idx + 1}`,
        weightKg: p.weightKg || 1,
        boxType: p.boxType || 'STANDARD_BOX',
      }))
    : [
        {
          id: '1',
          packageNumber: 'PKG-01',
          weightKg: 2.5,
          boxType: 'STANDARD_BOX',
        },
      ];

  const [carrier, setCarrier] = useState(initialCarrier);
  const [customCarrier, setCustomCarrier] = useState('');
  const [trackingNumber, setTrackingNumber] = useState(initialTracking);
  const [notes, setNotes] = useState('');
  const [packages, setPackages] = useState(initialPackages);
  const [actionError, setActionError] = useState(null);

  const dispatchExistingMutation = useMutation({
    mutationFn: (payload) => dispatchShipment(shipment?._id || shipment?.id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      onClose();
    },
    onError: (err) => {
      setActionError(err.response?.data?.message || err.message || 'Dispatch failed');
    },
  });

  const createAndDispatchMutation = useMutation({
    mutationFn: async (payload) => {
      const created = await createShipment({
        salesOrder: salesOrder?._id || salesOrder?.id,
        carrier: payload.carrier,
        trackingNumber: payload.trackingNumber,
        packages: payload.packages,
        notes: payload.notes,
      });
      return await dispatchShipment(created._id || created.id, {
        carrier: payload.carrier,
        trackingNumber: payload.trackingNumber,
        notes: payload.notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['sales-orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      onClose();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.message || err.message || 'Failed to create and dispatch shipment',
      );
    },
  });

  const handleAddPackage = () => {
    setPackages((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        packageNumber: `PKG-${(prev.length + 1).toString().padStart(2, '0')}`,
        weightKg: 1,
        boxType: 'STANDARD_BOX',
      },
    ]);
  };

  const handleRemovePackage = (index) => {
    if (packages.length <= 1) return;
    setPackages((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handlePackageChange = (index, field, value) => {
    setPackages((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setActionError(null);

    const finalCarrier = carrier === 'OTHER' ? customCarrier.trim() : carrier;
    if (!finalCarrier) {
      setActionError('Please specify shipping carrier');
      return;
    }

    if (!trackingNumber.trim()) {
      setActionError('Please provide a tracking / bill of lading number');
      return;
    }

    const payload = {
      carrier: finalCarrier,
      trackingNumber: trackingNumber.trim(),
      notes: notes.trim() || undefined,
      packages: packages.map((pkg) => ({
        packageNumber: pkg.packageNumber,
        weightKg: Number(pkg.weightKg) || 0,
        boxType: pkg.boxType,
      })),
    };

    if (shipment) {
      dispatchExistingMutation.mutate(payload);
    } else if (salesOrder) {
      createAndDispatchMutation.mutate(payload);
    }
  };

  const isPending =
    dispatchExistingMutation.isPending || createAndDispatchMutation.isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {actionError && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Carrier & Tracking */}
      <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Logistics Carrier"
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
            required
            options={[
              ...COMMON_CARRIERS.map((c) => ({ value: c, label: c })),
              { value: 'OTHER', label: 'Other / Custom Carrier...' },
            ]}
          />

          {carrier === 'OTHER' && (
            <Input
              label="Custom Carrier Name"
              value={customCarrier}
              onChange={(e) => setCustomCarrier(e.target.value)}
              required
              placeholder="e.g. Acme Transport"
            />
          )}

          <Input
            label="Tracking Number / Waybill"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            required
            placeholder="e.g. 1Z9999999999999999"
          />
        </div>

        <Input
          label="Dispatch Notes / Gate Pass Info (Optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Loaded onto Bay 4 trailer. Driver signed invoice."
        />
      </div>

      {/* Cartonization / Packaging */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <PackageCheck className="h-4 w-4 text-indigo-600" />
            Package Cartonization ({packages.length} Cartons)
          </h4>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddPackage}
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add Carton
          </Button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
            <thead className="bg-slate-50 font-medium text-slate-600">
              <tr>
                <th className="px-3 py-2">Carton / Barcode</th>
                <th className="px-3 py-2">Container Type</th>
                <th className="px-3 py-2 w-32">Weight (KG)</th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {packages.map((pkg, idx) => (
                <tr key={pkg.id || idx}>
                  <td className="px-3 py-2 font-mono">
                    <Input
                      value={pkg.packageNumber}
                      onChange={(e) =>
                        handlePackageChange(idx, 'packageNumber', e.target.value)
                      }
                      required
                      className="text-xs font-mono"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Select
                      value={pkg.boxType}
                      onChange={(e) =>
                        handlePackageChange(idx, 'boxType', e.target.value)
                      }
                      options={BOX_TYPES}
                      className="text-xs"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={pkg.weightKg}
                      onChange={(e) =>
                        handlePackageChange(idx, 'weightKg', e.target.value)
                      }
                      required
                      className="text-xs text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    {packages.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemovePackage(idx)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warning / Audit Notice */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-200 p-3 text-xs text-indigo-900 flex items-start gap-2">
        <Truck className="h-4 w-4 text-indigo-600 shrink-0 mt-0.5" />
        <span>
          Dispatching this shipment will release reserved inventory and post an immutable{' '}
          <strong className="font-mono">SALES_ISSUE</strong> ledger entry for all assigned items.
        </span>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        <Button variant="outline" size="sm" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant="success"
          size="sm"
          type="submit"
          isLoading={isPending}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Confirm Dispatch &amp; Post Ledger
        </Button>
      </div>
    </form>
  );
};

/**
 * Dispatch Modal component wrapper.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is open.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object|null} [props.salesOrder=null] - Sales order to create and dispatch.
 * @param {object|null} [props.shipment=null] - Existing shipment to dispatch.
 * @returns {JSX.Element|null}
 */
export const DispatchModal = ({
  isOpen,
  onClose,
  salesOrder = null,
  shipment = null,
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        shipment
          ? `Dispatch Shipment: ${shipment.shipmentNumber}`
          : `Package & Ship Order: ${salesOrder?.soNumber || ''}`
      }
      size="xl"
    >
      <DispatchForm
        salesOrder={salesOrder}
        shipment={shipment}
        onClose={onClose}
      />
    </Modal>
  );
};

export default DispatchModal;
