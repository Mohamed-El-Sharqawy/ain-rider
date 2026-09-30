import { useQueryState, parseAsString } from 'nuqs';

export function useVehicleFilters() {
  const [driverId, setDriverId] = useQueryState('driverId', parseAsString.withDefault(''));

  const filters = { driverId: driverId || undefined };

  const clearFilters = () => {
    setDriverId('');
  };

  return { filters, driverId, setDriverId, clearFilters };
}
