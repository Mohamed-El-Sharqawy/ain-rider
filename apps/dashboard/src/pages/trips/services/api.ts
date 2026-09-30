// ─── Trips API ───────────────────────────────────────────────────────────────
// Raw HTTP calls for the trips domain.

import { api } from '@/api/client'
import type { TripDTO, TripStatsDTO, PaginatedTripsDTO, LegacyPaginatedTripsDTO } from './dto'

export interface TripFilters {
  status?: string
  riderId?: string
  driverId?: string
  search?: string
  page?: number
  limit?: number
}

export const tripsApi = {
  getAll: (params: TripFilters) =>
    api.get<PaginatedTripsDTO | LegacyPaginatedTripsDTO>('/admin/trips', { params }),

  getById: (id: string) => api.get<TripDTO>(`/admin/trips/${id}`),

  getStats: () => api.get<TripStatsDTO>('/admin/trips/stats'),

  cancel: (id: string, data: { reason: string; cancelledBy: string }) =>
    api.post<TripDTO>(`/admin/trips/${id}/cancel`, data),
}
