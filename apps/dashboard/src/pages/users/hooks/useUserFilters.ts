import { useQueryStates, parseAsInteger, parseAsString } from 'nuqs';

export function useUserFilters() {
  const [filters, setFilters] = useQueryStates({
    page: parseAsInteger.withDefault(1),
    search: parseAsString.withDefault(''),
    role: parseAsString.withDefault('all'),
    status: parseAsString.withDefault('all'),
  });

  const clearFilters = () => {
    setFilters({
      page: 1,
      search: '',
      role: 'all',
      status: 'all',
    });
  };

  return {
    filters: {
      ...filters,
      role: filters.role === 'all' ? undefined : filters.role,
      status: filters.status === 'all' ? undefined : filters.status,
      search: filters.search || undefined,
    },
    rawFilters: filters,
    setFilters,
    clearFilters,
  };
}
