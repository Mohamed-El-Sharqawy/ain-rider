import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { WebSocketProvider } from '@/providers/WebSocketProvider'
import { renderWithProviders } from '@/test/render'
import { installWebSocketMocks } from '@/test/ws-mock'
import { DashboardPage } from '../DashboardPage'

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

const admin = {
  id: 'admin-1', email: 'a@a.com', firstName: 'عامر', lastName: 'الأدمن', fullName: 'عامر الأدمن',
  phoneNumber: '+20', role: 'ADMIN' as const, status: 'ACTIVE',
  createdAt: '', updatedAt: '',
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: admin, isAuthenticated: true })
  api.get.mockReset()
})

function stubAll() {
  api.get.mockImplementation((url: string) => {
    if (url === '/admin/complaints') {
      return Promise.resolve({
        data: {
          data: [
            { id: 'cm-1', complainantId: 'u-1', complainantRole: 'RIDER', type: 'SAFETY', subject: 'شكوى أولى', description: 'وصف', status: 'PENDING', priority: 'HIGH', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', comments: [] },
            { id: 'cm-2', complainantId: 'u-2', complainantRole: 'DRIVER', type: 'PAYMENT', subject: 'شكوى ثانية', description: 'وصف', status: 'IN_PROGRESS', priority: 'LOW', createdAt: '2026-01-02T00:00:00Z', updatedAt: '2026-01-02T00:00:00Z', comments: [] },
          ],
          total: 2, page: 1, limit: 10, totalPages: 1,
        },
      })
    }
    if (url === '/admin/promos') {
      return Promise.resolve({
        data: [
          { id: 'p-1', code: 'ACTIVE1', type: 'PERCENTAGE', value: 10, maxUsagePerUser: 1, totalUsageLimit: 10, currentUsageCount: 0, status: 'ACTIVE', validFrom: '', validUntil: '', description: '', createdBy: '', createdAt: '', updatedAt: '' },
          { id: 'p-2', code: 'OLD1', type: 'FIXED', value: 5, maxUsagePerUser: 1, totalUsageLimit: 10, currentUsageCount: 0, status: 'INACTIVE', validFrom: '', validUntil: '', description: '', createdBy: '', createdAt: '', updatedAt: '' },
        ],
      })
    }
    if (url === '/admin/withdrawals') {
      return Promise.resolve({
        data: [
          { id: 'wd-1', userId: 'u-1', amount: 100, status: 'PENDING', bankDetails: { accountName: 'أ', accountNumber: '1', bankName: 'ب' }, createdAt: '', updatedAt: '' },
        ],
      })
    }
    return Promise.reject(new Error(url))
  })
}

describe('DashboardPage', () => {
  it('renders the error state and retries all three queries', async () => {
    installWebSocketMocks(vi.fn())
    api.get.mockRejectedValue(new Error('down'))
    renderWithProviders(
      <WebSocketProvider>
        <DashboardPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    expect(await screen.findByText('فشل تحميل بيانات لوحة التحكم')).toBeInTheDocument()

    stubAll()
    await userEvent.setup().click(screen.getByText('إعادة المحاولة'))
    expect(await screen.findByText('شكوى أولى')).toBeInTheDocument()
  })

  it('greets the user and renders stats, recent complaints and quick links', async () => {
    await act(async () => {
      installWebSocketMocks(vi.fn())
      stubAll()
      renderWithProviders(
        <WebSocketProvider>
          <DashboardPage />
        </WebSocketProvider>,
        { routerProps: { initialEntries: ['/'] } },
      )
    })
    expect(await screen.findByText('مرحباً، عامر')).toBeInTheDocument()
    expect(screen.getByText('الشكاوى المعلقة')).toBeInTheDocument()
    expect(screen.getByText('العروض النشطة')).toBeInTheDocument()
    expect(screen.getByText('طلبات السحب المعلقة')).toBeInTheDocument()
    expect(screen.getByText('شكوى أولى')).toBeInTheDocument()
    expect(screen.getByText('أحدث الشكاوى')).toBeInTheDocument()
    expect(screen.getByText('إدارة الشكاوى')).toBeInTheDocument()
    expect(screen.getByText('العروض الترويجية')).toBeInTheDocument()
    expect(screen.getByText('المحافظ والسحوبات')).toBeInTheDocument()
  })

  it('falls back to the generic greeting without a user', async () => {
    useAuthStore.setState({ user: null, isAuthenticated: false })
    await act(async () => {
      installWebSocketMocks(vi.fn())
      stubAll()
      renderWithProviders(
        <WebSocketProvider>
          <DashboardPage />
        </WebSocketProvider>,
        { routerProps: { initialEntries: ['/'] } },
      )
    })
    expect(await screen.findByText('مرحباً، مستخدم إداري')).toBeInTheDocument()
  })

  it('shows loading dots while counts are pending', async () => {
    installWebSocketMocks(vi.fn())
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/complaints') return new Promise(() => {})
      if (url === '/admin/promos') return Promise.resolve({ data: [] })
      if (url === '/admin/withdrawals') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    renderWithProviders(
      <WebSocketProvider>
        <DashboardPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    // complaints pending → '...' value, recent table shows the skeleton
    expect(await screen.findByText('أحدث الشكاوى')).toBeInTheDocument()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
    const dots = screen.getAllByText('...')
    expect(dots.length).toBeGreaterThanOrEqual(1)
    await waitFor(() => expect(api.get).toHaveBeenCalled())
  })

  it('navigates from the recent-complaint rows and quick-link cards', async () => {
    const user = userEvent.setup()
    const targets = [
      { label: 'شكوى أولى', marker: 'complaints-page' },
      { label: 'إدارة الشكاوى', marker: 'complaints-page' },
      { label: 'العروض الترويجية', marker: 'promos-page' },
      { label: 'المحافظ والسحوبات', marker: 'wallets-page' },
    ] as const
    for (const { label, marker } of targets) {
      let unmount = () => {}
      await act(async () => {
        installWebSocketMocks(vi.fn())
        stubAll()
        const rendered = renderWithProviders(
          <WebSocketProvider>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/complaints" element={<div>complaints-page</div>} />
              <Route path="/promos" element={<div>promos-page</div>} />
              <Route path="/wallets" element={<div>wallets-page</div>} />
            </Routes>
          </WebSocketProvider>,
          { routerProps: { initialEntries: ['/'] } },
        )
        unmount = rendered.unmount
      })
      await screen.findByText('شكوى أولى')
      await user.click(screen.getByText(label))
      expect(await screen.findByText(marker)).toBeInTheDocument()
      unmount()
    }
  })
})
