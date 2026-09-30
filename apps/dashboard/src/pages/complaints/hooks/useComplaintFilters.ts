import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';

export function useComplaintFilters() {
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const filters = {
    status: status === 'all' ? undefined : status,
    page,
    limit: 20,
  };

  const clearFilters = () => {
    setStatus('all');
    setPage(1);
  };

  return { filters, status, setStatus, page, setPage, clearFilters };
}
