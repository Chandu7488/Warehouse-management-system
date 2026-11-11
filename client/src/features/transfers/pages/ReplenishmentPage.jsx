/**
 * StockPilot WMS - Min/Max Forward Pick Replenishment Dashboard.
 *
 * Evaluates real-time pick face bin depletion, detects stock deficits,
 * identifies bulk reserve inventory, and provides one-click directed replenishment transfers.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Sliders,
  Plus,
  RefreshCw,
  AlertTriangle,
  ArrowRightLeft,
  ArrowLeft,
  CheckCircle2,
  Box,
  Layers,
} from 'lucide-react';
import {
  fetchReplenishmentRules,
  evaluateReplenishmentNeeds,
} from '../transfersApi.js';
import { fetchWarehouses } from '@/features/warehouses/warehousesApi.js';
import { useAuth } from '@/features/auth/AuthContext.js';
import { PERMISSIONS } from '@/lib/permissions.js';
import Button from '@/components/ui/Button.jsx';
import Select from '@/components/ui/Select.jsx';
import Badge from '@/components/ui/Badge.jsx';
import ReplenishmentRuleModal from '../components/ReplenishmentRuleModal.jsx';
import DirectBinTransferModal from '../components/DirectBinTransferModal.jsx';

/**
 * Replenishment Page component.
 *
 * @returns {JSX.Element}
 */
export const ReplenishmentPage = () => {
  const navigate = useNavigate();
  const { can: userCan } = useAuth();
  const canWrite =
    userCan(PERMISSIONS.TRANSFERS_WRITE) || userCan(PERMISSIONS.INVENTORY_WRITE);

  const [userWarehouseId, setUserWarehouseId] = useState('');
  const [activeTab, setActiveTab] = useState('deficits');
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [replenishModalData, setReplenishModalData] = useState(null);

  // Fetch warehouses
  const { data: warehousesData } = useQuery({
    queryKey: ['warehouses-list'],
    queryFn: () => fetchWarehouses({ limit: 100 }),
  });
  const warehouses = warehousesData?.items || [];
  const selectedWarehouseId =
    userWarehouseId ||
    warehouses.find((w) => w.code === 'WH-MAIN')?.id ||
    warehouses[0]?.id ||
    warehouses[0]?._id ||
    '';

  // Fetch evaluated needs/deficits for selected warehouse
  const {
    data: recommendations = [],
    isLoading: isNeedsLoading,
    refetch: refetchNeeds,
  } = useQuery({
    queryKey: ['replenishment-needs', selectedWarehouseId],
    queryFn: () => evaluateReplenishmentNeeds(selectedWarehouseId),
    enabled: Boolean(selectedWarehouseId),
  });

  // Fetch configured rules
  const {
    data: rules = [],
    isLoading: isRulesLoading,
  } = useQuery({
    queryKey: ['replenishment-rules', selectedWarehouseId],
    queryFn: () => fetchReplenishmentRules({ warehouse: selectedWarehouseId }),
    enabled: Boolean(selectedWarehouseId),
  });

  const criticalCount = recommendations.filter(
    (r) => r.status === 'CRITICAL_STOCKOUT',
  ).length;
  const belowMinCount = recommendations.filter(
    (r) => r.status === 'BELOW_MINIMUM',
  ).length;
  const totalReserveUnits = recommendations.reduce(
    (sum, r) => sum + (r.totalReserveAvailable || 0),
    0,
  );

  const handleQuickReplenish = (rec) => {
    const topReserve = rec.reserveBins?.[0];
    const topReserveLocId = topReserve?.location?.id || topReserve?.location?._id || '';
    const suggestedQty = topReserve
      ? Math.min(rec.deficitQuantity, topReserve.availableQty)
      : rec.deficitQuantity;

    setReplenishModalData({
      warehouse: selectedWarehouseId,
      product: rec.product?.id || rec.product?._id,
      sourceLocation: topReserveLocId,
      destinationLocation: rec.pickBin?.id || rec.pickBin?._id,
      quantity: suggestedQty,
      notes: `Automated replenishment wave for pick face ${rec.pickBin?.code || ''}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={() => navigate('/transfers')}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              title="Back to Transfers"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Pick Face Replenishment Engine
            </h1>
          </div>
          <p className="text-sm text-slate-500 pl-8">
            Min/Max inventory threshold monitoring, forward picking stock levels, and bulk reserve waves.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="w-64">
            <Select
              value={selectedWarehouseId}
              onChange={(e) => setUserWarehouseId(e.target.value)}
              options={warehouses.map((w) => ({
                value: w.id || w._id,
                label: `${w.code} - ${w.name}`,
              }))}
              placeholder="Select warehouse..."
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => refetchNeeds()}
            className="text-xs sm:text-sm"
            title="Re-evaluate Deficits"
          >
            <RefreshCw className="w-4 h-4 mr-1 text-slate-500" />
            Refresh
          </Button>

          {canWrite && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setEditingRule(null);
                setIsRuleModalOpen(true);
              }}
              className="text-xs sm:text-sm"
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Configure Rule
            </Button>
          )}
        </div>
      </div>

      {/* Metrics Dashboard */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Configured Rules
            </span>
            <Sliders className="w-4 h-4 text-indigo-500" />
          </div>
          <span className="text-2xl font-extrabold text-slate-900 mt-2 block">
            {rules.length}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Critical Stockouts
            </span>
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          </div>
          <span className="text-2xl font-extrabold text-rose-600 mt-2 block">
            {criticalCount}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Below Minimum
            </span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <span className="text-2xl font-extrabold text-amber-600 mt-2 block">
            {belowMinCount}
          </span>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Reserve Stock Avail
            </span>
            <Layers className="w-4 h-4 text-emerald-500" />
          </div>
          <span className="text-2xl font-extrabold text-emerald-600 mt-2 block">
            {totalReserveUnits} units
          </span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('deficits')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'deficits'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Replenishment Waves & Deficits ({recommendations.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rules')}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === 'rules'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Configured Min/Max Rules ({rules.length})
        </button>
      </div>

      {/* Tab Content: Replenishment Waves & Deficits */}
      {activeTab === 'deficits' && (
        <div className="space-y-4">
          {isNeedsLoading ? (
            <div className="p-12 text-center text-slate-500 bg-white border border-slate-200 rounded-xl">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-600" />
              Evaluating pick face inventory balances across warehouse...
            </div>
          ) : recommendations.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">All Forward Pick Bins Healthy</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mt-1">
                No inventory deficits detected. All active picking faces have stock levels above their configured minimum thresholds.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {recommendations.map((rec) => {
                const fillPercent = Math.min(
                  100,
                  Math.round((rec.currentOnHand / rec.maxQuantity) * 100),
                );
                return (
                  <div
                    key={rec.ruleId}
                    className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      {/* Product & Pick Face Info */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-slate-900 text-base">
                            {rec.product?.sku}
                          </span>
                          <span className="text-slate-400">·</span>
                          <span className="text-sm font-medium text-slate-700">
                            {rec.product?.name}
                          </span>
                          <Badge
                            variant={
                              rec.status === 'CRITICAL_STOCKOUT' ? 'danger' : 'warning'
                            }
                          >
                            {rec.status.replace(/_/g, ' ')}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                          <span>
                            Pick Bin Face:{' '}
                            <strong className="font-mono text-slate-900">
                              {rec.pickBin?.code || rec.pickBin?.name}
                            </strong>
                          </span>
                          <span>·</span>
                          <span>
                            Min Trigger: <strong>{rec.minQuantity}</strong>
                          </span>
                          <span>·</span>
                          <span>
                            Max Target: <strong>{rec.maxQuantity}</strong>
                          </span>
                        </div>
                      </div>

                      {/* Stock Progress Bar & Deficit */}
                      <div className="w-full lg:w-72 space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-500 font-medium">
                            On-Hand: <strong className="text-slate-900">{rec.currentOnHand}</strong>
                          </span>
                          <span className="font-bold text-rose-600">
                            Deficit: +{rec.deficitQuantity}
                          </span>
                        </div>

                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-2.5 rounded-full ${
                              rec.status === 'CRITICAL_STOCKOUT'
                                ? 'bg-rose-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${fillPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Reserve Availability & 1-Click Replenish Trigger */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                            Reserve Stock
                          </span>
                          <span className="text-xs font-bold text-slate-800">
                            {rec.totalReserveAvailable} units in{' '}
                            {rec.reserveBins?.length || 0} reserve bin
                            {rec.reserveBins?.length === 1 ? '' : 's'}
                          </span>
                        </div>

                        {canWrite && (
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={rec.totalReserveAvailable <= 0}
                            onClick={() => handleQuickReplenish(rec)}
                            className="bg-indigo-600 hover:bg-indigo-700 whitespace-nowrap"
                          >
                            <ArrowRightLeft className="w-3.5 h-3.5 mr-1.5" />
                            Quick Replenish
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Reserve Bins Recommendation Sub-row */}
                    {rec.reserveBins && rec.reserveBins.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-slate-500 font-medium">Suggested Bulk Source Bins:</span>
                        {rec.reserveBins.slice(0, 3).map((rb, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-700 rounded font-mono text-[11px]"
                          >
                            <Box className="w-3 h-3 text-slate-400" />
                            {rb.location?.code}: {rb.availableQty} avail
                          </span>
                        ))}
                        {rec.reserveBins.length > 3 && (
                          <span className="text-slate-400 text-[11px]">
                            +{rec.reserveBins.length - 3} more bins
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Configured Min/Max Rules */}
      {activeTab === 'rules' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Forward Pick Face Rules ({rules.length})
            </h3>
            {canWrite && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditingRule(null);
                  setIsRuleModalOpen(true);
                }}
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Add Rule
              </Button>
            )}
          </div>

          {isRulesLoading ? (
            <div className="p-8 text-center text-slate-500">Loading rules...</div>
          ) : rules.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              No replenishment rules configured for this warehouse yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/70 text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-2.5">Product SKU & Name</th>
                    <th className="px-4 py-2.5">Forward Pick Bin</th>
                    <th className="px-4 py-2.5 text-right">Min Trigger</th>
                    <th className="px-4 py-2.5 text-right">Max Capacity</th>
                    <th className="px-4 py-2.5">Status</th>
                    <th className="px-4 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rules.map((rule) => (
                    <tr key={rule.id || rule._id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900 block">{rule.product?.sku}</span>
                        <span className="text-slate-500">{rule.product?.name}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-slate-700">
                        {rule.location?.code} - {rule.location?.name || rule.location?.path}
                      </td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-800">
                        {rule.minQuantity}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-900">
                        {rule.maxQuantity}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={rule.isActive ? 'success' : 'secondary'}>
                          {rule.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {canWrite && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingRule(rule);
                              setIsRuleModalOpen(true);
                            }}
                            className="text-xs px-2 py-0.5"
                          >
                            Edit
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Configure Rule Modal */}
      <ReplenishmentRuleModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setEditingRule(null);
        }}
        initialRule={editingRule}
      />

      {/* 1-Click Quick Direct Bin Relocation Modal */}
      {replenishModalData && (
        <DirectBinTransferModal
          isOpen={Boolean(replenishModalData)}
          onClose={() => setReplenishModalData(null)}
          initialValues={replenishModalData}
        />
      )}
    </div>
  );
};

export default ReplenishmentPage;
