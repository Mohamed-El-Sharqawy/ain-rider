// ─── Trip Filters Hook ───────────────────────────────────────────────────────
// URL state for trip filters using nuqs.

import { useQueryState, parseAsInteger, parseAsString } from 'nuqs'

export function useTripFilters() {
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1))
  const [search, setSearch] = useQueryState('search', parseAsString.withDefault(''))
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('all'))
  const [riderId, setRiderId] = useQueryState('riderId', parseAsString.withDefault(''))
  const [driverId, setDriverId] = useQueryState('driverId', parseAsString.withDefault(''))

  const filters = {
    page,
    limit: 20,
    search: search || undefined,
    status: status === 'all' ? undefined : status,
    riderId: riderId || undefined,
    driverId: driverId || undefined,
  }

  const clearFilters = () => {
    setPage(1)
    setSearch('')
    setStatus('all')
    setRiderId('')
    setDriverId('')
  }

  return {
    filters,
    page,
    setPage,
    search,
    setSearch,
    status,
    setStatus,
    riderId,
    setRiderId,
    driverId,
    setDriverId,
    clearFilters,
  }
}
