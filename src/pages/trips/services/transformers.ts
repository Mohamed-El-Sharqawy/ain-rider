// ─── Trips Transformers ──────────────────────────────────────────────────────
// Transforms raw backend DTOs into clean app models.

import type { TripDTO, TripStatsDTO, PaginatedTripsDTO } from './dto'

export interface Trip {
  id: string
  riderId: string
  driverId: string | null
  status: string
  pickupAddress: string
  dropoffAddress: string
  pickupLat: number
  pickupLng: number
  dropoffLat: number
  dropoffLng: number
  estimatedFare: number
  actualFare: number | null
  paymentMethod: string
  paymentMethodLabel: string
  paymentStatus: string
  paymentStatusLabel: string
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

export interface TripStats {
  total: number
  completed: number
  cancelled: number
  inProgress: number
  revenue: number
  pendingPayments: number
  collectedPayments: number
}

export interface PaginatedTrips {
  data: Trip[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'نقدي',
  CARD: 'بطاقة',
  WALLET: 'المحفظة',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'قيد الانتظار',
  COLLECTED: 'تم التحصيل',
  FAILED: 'فشل',
}

export function transformTrip(dto: TripDTO): Trip {
  return {
    id: dto.id,
    riderId: dto.riderId,
    driverId: dto.driverId,
    status: dto.status,
    pickupAddress: dto.pickupAddress,
    dropoffAddress: dto.dropoffAddress,
    pickupLat: dto.pickupLat,
    pickupLng: dto.pickupLng,
    dropoffLat: dto.dropoffLat,
    dropoffLng: dto.dropoffLng,
    estimatedFare: dto.estimatedFare,
    actualFare: dto.actualFare,
    paymentMethod: dto.paymentMethod,
    paymentMethodLabel: PAYMENT_METHOD_LABELS[dto.paymentMethod] ?? dto.paymentMethod,
    paymentStatus: dto.paymentStatus,
    paymentStatusLabel: PAYMENT_STATUS_LABELS[dto.paymentStatus] ?? dto.paymentStatus,
    promoCode: dto.promoCode,
    promoDiscount: dto.promoDiscount,
    distance: dto.distance,
    duration: dto.duration,
    requestedAt: dto.requestedAt,
    matchedAt: dto.matchedAt,
    startedAt: dto.startedAt,
    completedAt: dto.completedAt,
    cancelledAt: dto.cancelledAt,
    cancellationReason: dto.cancellationReason,
    cancelledBy: dto.cancelledBy,
    driverRating: dto.driverRating,
    riderRating: dto.riderRating,
    updatedAt: dto.updatedAt,
  }
}

export function transformTripStats(dto: TripStatsDTO): TripStats {
  return dto
}

export function transformPaginatedTrips(dto: PaginatedTripsDTO): PaginatedTrips {
  return {
    data: dto.data.map(transformTrip),
    total: dto.meta.total,
    page: dto.meta.page,
    limit: dto.meta.limit,
    totalPages: dto.meta.totalPages,
  }
}
