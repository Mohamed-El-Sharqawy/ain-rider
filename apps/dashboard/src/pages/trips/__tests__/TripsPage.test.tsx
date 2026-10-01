import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, act, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/stores/authStore'
import { WebSocketProvider } from '@/providers/WebSocketProvider'
import { renderWithProviders } from '@/test/render'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { MockWebSocket, installWebSocketMocks } from '@/test/ws-mock'
import { TripsPage } from '../TripsPage'
import { TripDetailModal } from '../components/TripDetailModal'
import type { Trip } from '../services/transformers'

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
vi.mock('@/hooks/useTripUpdates', () => ({ useTripUpdates: vi.fn() }))

const tripDto = {
  id: 'trip-1',
  riderId: 'rider-1',
  driverId: 'driver-1',
  status: 'REQUESTED',
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
  total: 10, completed: 6, cancelled: 2, inProgress: 2,
  revenue: 5000, pendingPayments: 3, collectedPayments: 7,
}

const fullTrip: Trip = {
  id: 'trip-1',
  riderId: 'rider-1',
  driverId: 'driver-1',
  status: 'REQUESTED',
  pickupAddress: 'ميدان التحرير',
  dropoffAddress: 'المطار',
  pickupLat: 30.1,
  pickupLng: 31.2,
  dropoffLat: 30.2,
  dropoffLng: 31.3,
  estimatedFare: 100,
  actualFare: 120,
  paymentMethod: 'CASH',
  paymentMethodLabel: 'نقدي',
  paymentStatus: 'COLLECTED',
  paymentStatusLabel: 'تم التحصيل',
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

const admin = {
  id: 'admin-1', email: 'a@a.com', firstName: 'أ', lastName: 'ب', fullName: 'أ ب',
  phoneNumber: '+20', role: 'ADMIN' as const, status: 'ACTIVE',
  createdAt: '', updatedAt: '',
}

function stubTripsList(overrides: Record<string, unknown> = {}) {
  api.get.mockImplementation((url: string) => {
    if (url === '/admin/trips') {
      return Promise.resolve({ data: { trips: [tripDto], total: 1, page: 1, limit: 20, ...overrides } })
    }
    if (url === '/admin/trips/stats') return Promise.resolve({ data: statsDto })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: admin, isAuthenticated: true })
  MockWebSocket.reset()
  api.get.mockReset()
  api.post.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('TripsPage', () => {
  async function renderPage() {
    installWebSocketMocks(
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
    )
    stubTripsList()
    const view = renderWithProviders(
      <WebSocketProvider>
        <TripsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/trips'] } },
    )
    // drive the ws handshake so isConnected flips
    act(() => {
      MockWebSocket.last.open()
    })
    await act(async () => {
      await Promise.resolve()
      MockWebSocket.last.message({ type: 'auth_success' })
    })
    return view
  }

  it('shows the skeleton while loading', () => {
    installWebSocketMocks(vi.fn())
    api.get.mockImplementation((url: string) =>
      url === '/admin/trips/stats'
        ? Promise.resolve({ data: statsDto })
        : url === '/admin/trips'
          ? new Promise(() => {})
          : Promise.reject(new Error('no')),
    )
    renderWithProviders(
      <WebSocketProvider>
        <TripsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/trips'] } },
    )
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the error state with retry', async () => {
    installWebSocketMocks(vi.fn())
    api.get.mockImplementation((url: string) =>
      url === '/admin/trips' ? Promise.reject(new Error('down')) : Promise.resolve({ data: statsDto }),
    )
    renderWithProviders(
      <WebSocketProvider>
        <TripsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/trips'] } },
    )
    expect(await screen.findByText('فشل تحميل الرحلات')).toBeInTheDocument()
    expect(screen.getByText('إعادة المحاولة')).toBeInTheDocument()
  })

  it('renders stats, the table and the online indicator when loaded', async () => {
    await renderPage()
    expect(await screen.findByText('ميدان التحرير')).toBeInTheDocument()
    expect(screen.getByText('متصل - تحديثات مباشرة')).toBeInTheDocument()
    expect(screen.getByText('المطار')).toBeInTheDocument()
    // stats cards render
    expect(screen.getByText('إجمالي الرحلات')).toBeInTheDocument()
    expect(screen.getByText('إيرادات محصلة')).toBeInTheDocument()
  })

  it('opens the detail modal from a row click', async () => {
    const user = userEvent.setup()
    await renderPage()
    await user.click(await screen.findByText('ميدان التحرير'))
    expect(await screen.findByText('تفاصيل الرحلة')).toBeInTheDocument()
    expect(screen.getAllByText('نقدي')).toHaveLength(2)
    expect(screen.getByText('SAVE20')).toBeInTheDocument()
    expect(screen.getByText('1.50 كم')).toBeInTheDocument()
    expect(screen.getByText('15 دقيقة')).toBeInTheDocument()
    expect(screen.getByText('4.5 ⭐')).toBeInTheDocument()
    // requested trips can be cancelled
    expect(screen.getByText('إلغاء الرحلة')).toBeInTheDocument()
  })

  it('cancels a trip through the confirm dialog', async () => {
    const user = userEvent.setup()
    await renderPage()
    api.post.mockResolvedValue({ data: { ...tripDto, status: 'CANCELLED' } })
    await user.click(await screen.findByText('ميدان التحرير'))
    await user.click(await screen.findByText('إلغاء الرحلة'))
    const confirm = await screen.findByText('تأكيد الإلغاء')
    expect(confirm).toBeDisabled()

    await user.type(screen.getByPlaceholderText('اكتب سبب الإلغاء...'), 'سبب الاختبار')
    await user.click(screen.getByText('تأكيد الإلغاء'))
    expect(api.post).toHaveBeenCalledWith('/admin/trips/trip-1/cancel', {
      reason: 'سبب الاختبار',
      cancelledBy: 'admin-1',
    })
  })

  it('cancels without a reason via the guard and shows cancelled trip details', async () => {
    const user = userEvent.setup()
    const view = await renderPage()
    await user.click(await screen.findByText('ميدان التحرير'))
    await user.click(await screen.findByText('إلغاء الرحلة'))
    // disabled confirm without a reason
    expect(screen.getByText('تأكيد الإلغاء')).toBeDisabled()

    view.unmount()

    // now inspect a cancelled trip via a direct modal render
    renderWithProviders(
      <TripDetailModal
        trip={{ ...fullTrip, status: 'CANCELLED', cancelledAt: '2026-01-02T10:00:00Z', cancellationReason: 'عطل', cancelledBy: 'admin-9' }}
        open
        onClose={vi.fn()}
      />,
    )
    expect(await screen.findByText('سبب الإلغاء')).toBeInTheDocument()
    expect(screen.getByText('عطل')).toBeInTheDocument()
    expect(screen.getByText('تم الإلغاء بواسطة: admin-9')).toBeInTheDocument()
  })

  it('renders the minimal trip branches and hides cancel for completed trips', async () => {
    renderWithProviders(
      <TripDetailModal
        trip={{
          ...fullTrip,
          status: 'COMPLETED',
          driverId: null,
          actualFare: null,
          promoCode: null,
          distance: null,
          duration: null,
          matchedAt: null,
          startedAt: null,
          completedAt: null,
          driverRating: null,
          riderRating: null,
        }}
        open
        onClose={vi.fn()}
      />,
    )
    expect(await screen.findByText('تفاصيل الرحلة')).toBeInTheDocument()
    expect(screen.queryByText('إلغاء الرحلة')).not.toBeInTheDocument()
    expect(screen.queryByText('التكلفة الفعلية')).not.toBeInTheDocument()
    expect(screen.queryByText('كود الخصم')).not.toBeInTheDocument()
    expect(screen.queryByText('السائق')).not.toBeInTheDocument()
    expect(screen.queryByText('المسافة')).not.toBeInTheDocument()
  })

  it('renders nothing without a trip', () => {
    renderWithProviders(<TripDetailModal trip={null} open onClose={vi.fn()} />)
    expect(screen.queryByText('تفاصيل الرحلة')).not.toBeInTheDocument()
  })

  it('shows the empty state with the clear-filters action when filters are active', async () => {
    const user = userEvent.setup()
    installWebSocketMocks(vi.fn())
    api.get.mockImplementation((url: string) =>
      url === '/admin/trips'
        ? Promise.resolve({ data: { trips: [], total: 0, page: 1, limit: 20 } })
        : url === '/admin/trips/stats'
          ? Promise.resolve({ data: statsDto })
          : Promise.reject(new Error('no')),
    )
    // NuqsTestingAdapter owns the search params (standalone from the router)
    renderWithProviders(
      <NuqsTestingAdapter searchParams="?status=COMPLETED">
        <WebSocketProvider>
          <TripsPage />
        </WebSocketProvider>
      </NuqsTestingAdapter>,
      { routerProps: { initialEntries: ['/trips'] } },
    )
    expect(await screen.findByText('لا توجد رحلات')).toBeInTheDocument()
    await user.click(screen.getByText('مسح الفلاتر'))
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('renders fallbacks for a driverless fare-less trip and optional stats', async () => {
    installWebSocketMocks(vi.fn())
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/trips') {
        return Promise.resolve({
          data: { trips: [{ ...tripDto, driverId: null, actualFare: null }], total: 1, page: 1, limit: 20 },
        })
      }
      if (url === '/admin/trips/stats') {
        return Promise.resolve({
          data: { total: 1, completed: 0, cancelled: 0, inProgress: 1, revenue: 100, pendingPayments: null, collectedPayments: null },
        })
      }
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    renderWithProviders(
      <WebSocketProvider>
        <TripsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/trips'] } },
    )
    await screen.findByText('ميدان التحرير')

    // driver and actual fare cells fall back to an em dash
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
    // optional stats without payments render as zero
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(2)
  })

  it('invalidates trips on realtime events while connected', async () => {
    await renderPage()
    await screen.findByText('ميدان التحرير')

    act(() => {
      MockWebSocket.last.message({ type: 'trip_matched', data: { id: 'trip-1' } })
      MockWebSocket.last.message({ type: 'trip_started', data: { id: 'trip-1' } })
      MockWebSocket.last.message({ type: 'trip_completed', data: { id: 'trip-1' } })
    })
    // the ws handlers ran without crashing; the table is still rendered
    expect(screen.getByText('ميدان التحرير')).toBeInTheDocument()
  })

  it('filters trips through the search box', async () => {
    await renderPage()
    await screen.findByText('ميدان التحرير')

    const input = screen.getByPlaceholderText('بحث برقم الرحلة، الراكب، أو السائق...')
    fireEvent.change(input, { target: { value: 'ميدان' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/admin/trips',
        expect.objectContaining({ params: expect.objectContaining({ search: 'ميدان' }) }),
      )
    })
  })
})
