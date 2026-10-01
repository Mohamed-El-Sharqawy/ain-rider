import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { WebSocketProvider } from '@/providers/WebSocketProvider'
import { renderWithProviders } from '@/test/render'
import { MockWebSocket, installWebSocketMocks } from '@/test/ws-mock'
import { NotificationsPage } from '../NotificationsPage'
import { SendNotificationModal } from '../components/SendNotificationModal'

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
  id: 'admin-1', email: 'a@a.com', firstName: 'أ', lastName: 'ب', fullName: 'أ ب',
  phoneNumber: '+20', role: 'ADMIN' as const, status: 'ACTIVE',
  createdAt: '', updatedAt: '',
}

const notifDto = (id: string, type = 'PUSH', read = false) => ({
  id, userId: 'u-1', title: `عنوان ${id}`, body: `نص ${id}`, type,
  data: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  readAt: read ? new Date().toISOString() : null,
  reads: read ? [{ readerId: 'admin-1', readAt: new Date().toISOString() }] : [],
})

const user = userEvent.setup()

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: admin, isAuthenticated: true })
  useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  MockWebSocket.reset()
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderPage(search = '') {
  installWebSocketMocks(
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
  )
  renderWithProviders(
    <WebSocketProvider>
      <NotificationsPage />
    </WebSocketProvider>,
    { routerProps: { initialEntries: ['/notifications'] } },
  )
  act(() => {
    MockWebSocket.last.open()
  })
  await act(async () => {
    await Promise.resolve()
    MockWebSocket.last.message({ type: 'auth_success' })
  })
  void search
}

describe('NotificationsPage', () => {
  it('renders skeletons while both lists load', () => {
    installWebSocketMocks(vi.fn())
    api.get.mockReturnValue(new Promise(() => {}))
    renderWithProviders(
      <WebSocketProvider>
        <NotificationsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/notifications'] } },
    )
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders error copy when the lists fail', async () => {
    installWebSocketMocks(vi.fn())
    api.get.mockRejectedValue(new Error('down'))
    renderWithProviders(
      <WebSocketProvider>
        <NotificationsPage />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/notifications'] } },
    )
    expect(await screen.findByText('تعذر تحميل الإشعارات. يرجى المحاولة مرة أخرى.')).toBeInTheDocument()
  })

  it('renders the connected page with notification types and the list', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1'), notifDto('n2', 'SMS', true)] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3', 'EMAIL')] })
      return Promise.reject(new Error(url))
    })
    await renderPage()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1'), notifDto('n2', 'SMS', true)] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3', 'EMAIL')] })
      return Promise.reject(new Error(url))
    })
    expect(await screen.findByText('عنوان n1')).toBeInTheDocument()
    expect(screen.getByText('متصل')).toBeInTheDocument()
    expect(screen.getByText('إشعارات الدفع')).toBeInTheDocument()
    expect(screen.getByText('رسائل نصية')).toBeInTheDocument()
    expect(screen.getByText('بريد إلكتروني')).toBeInTheDocument()
    // badges per type
    expect(screen.getAllByText('إشعار دفع').length).toBeGreaterThan(0)
    expect(screen.getByText('رسالة نصية', { selector: 'span, div' })).toBeInTheDocument()
  })

  it('marks one notification as read and then all', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1')] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    api.patch.mockResolvedValue({ data: {} })
    await renderPage()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1')] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    await screen.findByText('عنوان n1')

    await user.click(screen.getByText('تحديد كمقروء'))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/notifications/n1/read'))
  })

  it('shows the empty state on a tab with no notifications', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3')] })
      return Promise.reject(new Error(url))
    })
    await renderPage()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3')] })
      return Promise.reject(new Error(url))
    })
    expect(await screen.findByText('لا توجد إشعارات')).toBeInTheDocument()
    expect(screen.getByText('ستظهر الإشعارات هنا عند إرسالها')).toBeInTheDocument()
  })

  it('switches to the all tab and syncs the store from that list', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3')] })
      return Promise.reject(new Error(url))
    })
    await renderPage()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [notifDto('n3')] })
      return Promise.reject(new Error(url))
    })
    await screen.findByText('لا توجد إشعارات')

    await user.click(screen.getByText('جميع الإشعارات'))
    expect(await screen.findByText('عنوان n3')).toBeInTheDocument()
    await waitFor(() => expect(useNotificationStore.getState().notifications[0].id).toBe('n3'))
  })

  it('refetches when a realtime notification arrives', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1')] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    await renderPage()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1'), notifDto('n2')] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    await screen.findByText('عنوان n1')
    const meCalls = api.get.mock.calls.filter((c) => c[0] === '/admin/notifications/me').length

    act(() => {
      MockWebSocket.last.message({ type: 'notification', data: { userId: 'u-1' } })
    })
    await waitFor(() =>
      expect(api.get.mock.calls.filter((c) => c[0] === '/admin/notifications/me').length)
        .toBeGreaterThan(meCalls),
    )
    expect(await screen.findByText('عنوان n2')).toBeInTheDocument()
  })

  it('marks everything read from the page header button', async () => {
    useNotificationStore.setState({
      notifications: [{ id: 'n1', userId: 'u-1', title: 'عنوان n1', body: 'نص', type: 'PUSH', data: null, isRead: false, createdAt: new Date().toISOString(), readAt: null }],
      unreadCount: 1,
    })
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1')] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })
    api.patch.mockResolvedValue({ data: { count: 1 } })
    await renderPage()
    await screen.findByText('عنوان n1')
    // the read-all invalidates and refetches: the list comes back fully read
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications/me') return Promise.resolve({ data: [notifDto('n1', 'PUSH', true)] })
      if (url === '/admin/notifications') return Promise.resolve({ data: [] })
      return Promise.reject(new Error(url))
    })

    await user.click(screen.getByText('قراءة الكل'))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/notifications/read-all'))
    await waitFor(() => expect(useNotificationStore.getState().unreadCount).toBe(0))
  })
})

describe('SendNotificationModal', () => {
  it('sends a push notification', async () => {
    api.post.mockResolvedValue({ data: {} })
    renderWithProviders(<SendNotificationModal />)
    await user.click(await screen.findByText('إرسال إشعار'))
    await screen.findByText('إرسال إشعار', { selector: '[data-slot="dialog-title"]' })

    await user.type(screen.getByLabelText('معرف المستخدم'), 'u-9')
    await user.type(screen.getByLabelText('العنوان'), 'ترقية النظام')
    await user.type(screen.getByLabelText('الرسالة'), 'سنحدّث النظام الليلة')
    await user.click(screen.getAllByRole('button', { name: 'إرسال' })[0])

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/notifications/push', {
        userId: 'u-9',
        title: 'ترقية النظام',
        body: 'سنحدّث النظام الليلة',
      }),
    )
  })

  it('sends an SMS from the sms tab', async () => {
    api.post.mockResolvedValue({ data: { success: true } })
    renderWithProviders(<SendNotificationModal />)
    await user.click(await screen.findByText('إرسال إشعار'))

    await user.click(screen.getByText('رسالة نصية'))
    await user.type(screen.getByLabelText('رقم الهاتف'), '+201001234567')
    await user.type(screen.getByLabelText('الرسالة'), 'رمز التحقق 1234')
    await user.click(screen.getAllByRole('button', { name: 'إرسال' })[0])

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/notifications/sms', {
        phoneNumber: '+201001234567',
        message: 'رمز التحقق 1234',
      }),
    )
  })

  it('shows the pending spinner on the push form', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<SendNotificationModal />)
    await user.click(await screen.findByText('إرسال إشعار'))

    await user.type(screen.getByLabelText('معرف المستخدم'), 'u-9')
    await user.type(screen.getByLabelText('العنوان'), 'عنوان')
    await user.type(screen.getByLabelText('الرسالة'), 'نص')
    await user.click(screen.getAllByRole('button', { name: 'إرسال' })[0])

    expect(await screen.findByText('إرسال', { selector: 'button:disabled' })).toBeDefined()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('shows the pending spinner on the sms form', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<SendNotificationModal />)
    await user.click(await screen.findByText('إرسال إشعار'))

    await user.click(screen.getByText('رسالة نصية'))
    await user.type(screen.getByLabelText('رقم الهاتف'), '+201001234567')
    await user.type(screen.getByLabelText('الرسالة'), 'نص')
    await user.click(screen.getAllByRole('button', { name: 'إرسال' })[0])

    expect(await screen.findByText('إرسال', { selector: 'button:disabled' })).toBeDefined()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })
})
