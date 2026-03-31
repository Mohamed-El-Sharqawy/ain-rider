// ─── Trips Queries ───────────────────────────────────────────────────────────
// TanStack Query hooks for reading trips data.

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { tripsApi } from './api'
import { transformTrip, transformTripStats, transformPaginatedTrips } from './transformers'
import type { TripFilters } from './api'

export const tripKeys = {
  all: ['trips'] as const,
  list: (filters: TripFilters) => ['trips', 'list', filters] as const,
  detail: (id: string) => ['trips', 'detail', id] as const,
  stats: () => ['trips', 'stats'] as const,
}

export const useGetAllTrips = (filters: TripFilters) => {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: () =>
      tripsApi.getAll(filters).then((r) =>
        transformPaginatedTrips(r.data, { page: filters.page, limit: filters.limit }),
      ),
    placeholderData: keepPreviousData,
  })
}

export const useGetTripById = (id: string) => {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripsApi.getById(id).then((r) => transformTrip(r.data)),
    enabled: !!id,
  })
}

export const useGetTripStats = () => {
  return useQuery({
    queryKey: tripKeys.stats(),
    queryFn: () => tripsApi.getStats().then((r) => transformTripStats(r.data)),
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  })
}
