// ─── Trips Queries ───────────────────────────────────────────────────────────
// TanStack Query hooks for reading trips data.

import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { tripsApi } from './api'
import { transformTrip, transformTripStats, transformPaginatedTrips } from './transformers'
import type { TripFilters } from './api'

export const tripKeys = {
  all: ['trips'] as const,
  list: (filters: TripFilters) => [...tripKeys.all, 'list', filters] as const,
  detail: (id: string) => [...tripKeys.all, 'detail', id] as const,
  stats: () => [...tripKeys.all, 'stats'] as const,
}

export const useGetAllTrips = (filters: TripFilters) => {
  return useQuery({
    queryKey: tripKeys.list(filters),
    queryFn: () =>
      tripsApi.getAll(filters).then((r) =>
        transformPaginatedTrips(r.data, { page: filters.page, limit: filters.limit }),
      ),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

export const useGetTripById = (id: string) => {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripsApi.getById(id).then((r) => transformTrip(r.data)),
    enabled: !!id,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
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
