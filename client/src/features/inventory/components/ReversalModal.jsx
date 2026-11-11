/**
 * StockPilot WMS - Stock Ledger Reversal Modal.
 *
 * Prompts user for a mandatory audit justification before creating an equal-and-opposite
 * ledger reversal entry to maintain regulatory traceability.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import Modal from '@/components/ui/Modal.jsx';
import Button from '@/components/ui/Button.jsx';
import Input from '@/components/ui/Input.jsx';
import { reverseLedgerEntry } from '../inventoryApi.js';

const reversalSchema = z.object({
  reason: z.string().trim().min(3, 'Audit reason must be at least 3 characters long'),
});

/**
 * Reversal Modal component.
 *
 * @param {object} props - Component properties.
 * @param {boolean} props.isOpen - Whether modal is visible.
 * @param {Function} props.onClose - Dismiss callback.
 * @param {object} [props.targetEntry] - Ledger entry selected for reversal.
 * @returns {JSX.Element}
 */
export const ReversalModal = ({ isOpen, onClose, targetEntry }) => {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(reversalSchema),
    defaultValues: { reason: '' },
  });

  const mutation = useMutation({
    mutationFn: (values) =>
      reverseLedgerEntry(targetEntry?._id || targetEntry?.id, {
        reason: values.reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-balances'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-availability'] });
      onClose();
      reset();
    },
    onError: (err) => {
      setActionError(
        err.response?.data?.error?.message || err.message || 'Failed to reverse entry',
      );
    },
  });

  const onSubmit = async (values) => {
    setActionError(null);
    await mutation.mutateAsync(values);
  };

  if (!targetEntry) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Reverse Stock Ledger Entry" maxWidth="max-w-md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {actionError && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700 border border-red-200">
            {actionError}
          </div>
        )}

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <p className="font-semibold">Ledger Immutability Notice</p>
          <p className="mt-1">
            This action will not delete the original entry. It will post a new compensatory{' '}
            <span className="font-mono font-bold">REVERSAL</span> movement of quantity{' '}
            <span className="font-bold">{-targetEntry.quantity}</span> to restore previous stock
            levels.
          </p>
        </div>

        <div className="text-xs space-y-1 text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
          <div>
            <span className="font-medium text-slate-800">Movement Type:</span>{' '}
            {targetEntry.movementType}
          </div>
          <div>
            <span className="font-medium text-slate-800">Product:</span> {targetEntry.product?.sku}{' '}
            - {targetEntry.product?.name}
          </div>
          <div>
            <span className="font-medium text-slate-800">Location:</span>{' '}
            {targetEntry.location?.path}
          </div>
          <div>
            <span className="font-medium text-slate-800">Original Quantity:</span>{' '}
            {targetEntry.quantity}
          </div>
        </div>

        <Input
          label="Mandatory Audit Reason"
          placeholder="e.g. Correcting clerical entry error on GRN"
          error={errors.reason?.message}
          {...register('reason')}
        />

        <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="danger" isLoading={isSubmitting || mutation.isPending}>
            Confirm Reversal
          </Button>
        </div>
      </form>
    </Modal>
  );
};
