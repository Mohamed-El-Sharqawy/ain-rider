// ─── Trips DTO ───────────────────────────────────────────────────────────────
// Mirrors the backend API response shape exactly.
// Backend returns Trip model from trip_db (read-only connection).

export interface TripDTO {
  id: string
  riderId: string
  driverId: string | null
  status: string
  pickupLat: number
  pickupLng: number
  pickupAddress: string
  dropoffLat: number
  dropoffLng: number
  dropoffAddress: string
  estimatedFare: number
  actualFare: number | null
  paymentMethod: string
  paymentStatus: string
  promoCode: string | null
  promoDiscount: number
  distance: number | null
  duration: number | null
  requestedAt: string
  matchedAt: string | null
  startedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancellationReason: string | null
  cancelledBy: string | null
  driverRating: number | null
  riderRating: number | null
  updatedAt: string
}

export interface TripStatsDTO {
  total: number
  completed: number
  cancelled: number
  inProgress: number
  revenue: number
  pendingPayments: number
  collectedPayments: number
}

export interface PaginatedTripsDTO {
  data: TripDTO[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}
