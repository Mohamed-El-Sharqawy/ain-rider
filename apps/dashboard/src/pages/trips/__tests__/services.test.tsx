import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { type ReactNode } from 'react'
import { toast } from 'sonner'

const api = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}))
vi.mock('@/api/client', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api,
}))

import { tripsApi } from '../services/api'
import {
  useGetAllTrips,
  useGetTripById,
  useGetTripStats,
  tripKeys,
} from '../services/queries'
import { useCancelTrip } from '../services/mutations'
import {
  transformTrip,
  transformTripStats,
  transformPaginatedTrips,
} from '../services/transformers'
import { useTripFilters } from '../hooks/useTripFilters'

const tripDto = {
  id: 't-1',
  riderId: 'rider-1',
  driverId: 'driver-1',
  status: 'COMPLETED',
  pickupAddress: 'ميدان التحرير',
  dropoffAddress: 'المطار',
  pickupLat: 30.1,
  pickupLng: 31.2,
  dropoffLat: 30.2,
  dropoffLng: 31.3,
  estimatedFare: 100,
  actualFare: 120,
  paymentMethod: 'CASH',
  paymentStatus: 'COLLECTED',
  promoCode: 'SAVE20',
  promoDiscount: 20,
  distance: 1500,
  duration: 900,
  requestedAt: '2026-01-01T10:00:00Z',
  matchedAt: '2026-01-01T10:01:00Z',
  startedAt: '2026-01-01T10:02:00Z',
  completedAt: '2026-01-01T10:30:00Z',
  cancelledAt: null,
  cancellationReason: null,
  cancelledBy: null,
  driverRating: 4.5,
  riderRating: 5,
  updatedAt: '2026-01-01T10:30:00Z',
}

const statsDto = {
  total: 10,
  completed: 6,
  cancelled: 2,
  inProgress: 2,
  revenue: 5000,
  pendingPayments: 3,
  collectedPayments: 7,
}

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tripsApi', () => {
  it('calls the right endpoints', () => {
    tripsApi.getAll({ status: 'COMPLETED', page: 2 })
    expect(api.get).toHaveBeenCalledWith('/admin/trips', {
      params: { status: 'COMPLETED', page: 2 },
    })
    tripsApi.getById('t-9')
    expect(api.get).toHaveBeenCalledWith('/admin/trips/t-9')
    tripsApi.getStats()
    expect(api.get).toHaveBeenCalledWith('/admin/trips/stats')
    tripsApi.cancel('t-9', { reason: 'اختبار', cancelledBy: 'admin-1' })
    expect(api.post).toHaveBeenCalledWith('/admin/trips/t-9/cancel', {
      reason: 'اختبار',
      cancelledBy: 'admin-1',
    })
  })
})

describe('transformers', () => {
  it('maps known payment labels', () => {
    const trip = transformTrip(tripDto)
    expect(trip.paymentMethodLabel).toBe('نقدي')
    expect(trip.paymentStatusLabel).toBe('تم التحصيل')
    expect(trip.driverRating).toBe(4.5)
  })

  it('falls back to raw payment values for unknown enums', () => {
    const trip = transformTrip({
      ...tripDto,
      paymentMethod: 'CRYPTO',
      paymentStatus: 'WEIRD',
    })
    expect(trip.paymentMethodLabel).toBe('CRYPTO')
    expect(trip.paymentStatusLabel).toBe('WEIRD')
  })

  it('passes stats through', () => {
    expect(transformTripStats(statsDto)).toEqual(statsDto)
  })

  it('transforms the new paginated shape with fallbacks', () => {
    const result = transformPaginatedTrips({
      trips: [tripDto],
      total: 45,
    })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(45)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(20)
    expect(result.totalPages).toBe(3)
  })

  it('prefers dto page/limit over filters', () => {
    const result = transformPaginatedTrips(
      { trips: [], total: 5, page: 2, limit: 10 },
      { page: 3, limit: 50 },
    )
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
    expect(result.totalPages).toBe(1)
  })

  it('uses filter page/limit when the dto omits them', () => {
    const result = transformPaginatedTrips({ trips: [], total: 0 }, { page: 4, limit: 25 })
    expect(result.page).toBe(4)
    expect(result.limit).toBe(25)
    expect(result.totalPages).toBe(1)
  })

  it('transforms the legacy paginated shape', () => {
    const result = transformPaginatedTrips({
      data: [tripDto],
      meta: { total: 30, page: 2, limit: 10, totalPages: 3 },
    })
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(30)
    expect(result.page).toBe(2)
    expect(result.limit).toBe(10)
    expect(result.totalPages).toBe(3)
  })
})

describe('queries', () => {
  it('fetches and transforms the trips list', async () => {
    api.get.mockResolvedValue({ data: { trips: [tripDto], total: 1, page: 1, limit: 20 } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetAllTrips({ page: 1 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data[0].pickupAddress).toBe('ميدان التحرير')
    expect(api.get).toHaveBeenCalledWith('/admin/trips', { params: { page: 1 } })
  })

  it('skips the detail query without an id', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetTripById(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
    expect(api.get).not.toHaveBeenCalled()
  })

  it('fetches a trip by id', async () => {
    api.get.mockResolvedValue({ data: tripDto })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetTripById('t-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.id).toBe('t-1')
  })

  it('fetches trip stats with caching options', async () => {
    api.get.mockResolvedValue({ data: statsDto })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetTripStats(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.revenue).toBe(5000)
  })

  it('exposes stable query keys', () => {
    expect(tripKeys.all).toEqual(['trips'])
    expect(tripKeys.list({ page: 1 })).toEqual(['trips', 'list', { page: 1 }])
    expect(tripKeys.detail('x')).toEqual(['trips', 'detail', 'x'])
    expect(tripKeys.stats()).toEqual(['trips', 'stats'])
  })
})

describe('useCancelTrip', () => {
  it('cancels, invalidates and toasts on success', async () => {
    api.post.mockResolvedValue({ data: { ...tripDto, status: 'CANCELLED' } })
    const { wrapper, queryClient } = makeWrapper()
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useCancelTrip(), { wrapper })

    act(() => {
      result.current.mutate({ id: 't-1', reason: 'سبب', cancelledBy: 'admin-1' })
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.post).toHaveBeenCalledWith('/admin/trips/t-1/cancel', {
      reason: 'سبب',
      cancelledBy: 'admin-1',
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tripKeys.all })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: tripKeys.detail('t-1') })
    expect(toast.success).toHaveBeenCalledWith('تم إلغاء الرحلة بنجاح')
  })

  it('toasts the api error message on failure', async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'لا يمكن الإلغاء' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCancelTrip(), { wrapper })

    act(() => {
      result.current.mutate({ id: 't-1', reason: 'سبب', cancelledBy: 'admin-1' })
    })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('لا يمكن الإلغاء')
  })
})

describe('useTripFilters', () => {
  it('applies defaults and clears', async () => {
    const { result } = renderHook(() => useTripFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient()}>
          <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
        </QueryClientProvider>
      ),
    })
    expect(result.current.filters).toEqual({
      page: 1,
      limit: 20,
      search: undefined,
      status: undefined,
      riderId: undefined,
      driverId: undefined,
    })

    act(() => {
      result.current.setSearch('ميدان')
      result.current.setStatus('COMPLETED')
      result.current.setPage(3)
      result.current.setRiderId('r-1')
      result.current.setDriverId('d-1')
    })
    await waitFor(() => {
      expect(result.current.filters.search).toBe('ميدان')
    })

    act(() => {
      result.current.clearFilters()
    })
    await waitFor(() => {
      expect(result.current.filters.status).toBeUndefined()
      expect(result.current.filters.page).toBe(1)
    })
  })
})
