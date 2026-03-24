import { useQueryState, parseAsString } from 'nuqs';

export function useComplaintFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'));

  const filters = { status: status === 'all' ? undefined : status };

  const clearFilters = () => {
    setStatus('all');
  };

  return { filters, status, setStatus, clearFilters };
}
