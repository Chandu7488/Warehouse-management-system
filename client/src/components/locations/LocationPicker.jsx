/**
 * StockPilot WMS - Reusable Location Picker component.
 *
 * Provides searchable location and storage bin selection with purpose
 * and location type filtering for inventory operations.
 *
 * @license MIT
 * @copyright 2026 StockPilot WMS contributors
 */
import { useQuery } from '@tanstack/react-query';
import { fetchLocations } from '@/features/locations/locationsApi.js';
import Select from '@/components/ui/Select.jsx';

/**
 * Renders a location picker select input populated from the active warehouse.
 *
 * @param {object} props - Component properties.
 * @param {string} props.warehouseId - Warehouse facility identifier.
 * @param {string} [props.value=''] - Selected location identifier.
 * @param {Function} props.onChange - Selection change callback.
 * @param {string} [props.allowedType='BIN'] - Filter by type ('BIN', 'SHELF', etc.).
 * @param {string} [props.purpose] - Filter by purpose ('STORAGE', 'RECEIVING', etc.).
 * @param {string} [props.label='Storage Location'] - Label text.
 * @param {string} [props.placeholder='Select storage location...'] - Placeholder text.
 * @param {string} [props.error] - Validation error message.
 * @param {boolean} [props.disabled=false] - Disabled state.
 * @returns {JSX.Element} Location picker dropdown.
 */
export const LocationPicker = ({
  warehouseId,
  value = '',
  onChange,
  allowedType = 'BIN',
  purpose,
  label = 'Storage Location',
  placeholder = 'Select storage location...',
  error,
  disabled = false,
  ...props
}) => {
  const { data, isLoading } = useQuery({
    queryKey: ['locations-picker', { warehouse: warehouseId, type: allowedType, purpose }],
    queryFn: () =>
      fetchLocations({
        warehouse: warehouseId,
        type: allowedType || undefined,
        purpose: purpose || undefined,
        isActive: 'true',
        limit: 100,
      }),
    enabled: Boolean(warehouseId),
  });

  const locations = data?.items || [];

  return (
    <Select
      label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      disabled={disabled || isLoading || !warehouseId}
      {...props}
    >
      <option value="">
        {isLoading
          ? 'Loading locations...'
          : !warehouseId
            ? 'Select a warehouse first'
            : placeholder}
      </option>
      {locations.map((loc) => (
        <option key={loc.id} value={loc.id}>
          {loc.path} ({loc.type} &middot; {loc.purpose})
        </option>
      ))}
    </Select>
  );
};

export default LocationPicker;
