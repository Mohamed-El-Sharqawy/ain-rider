import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { screen, waitFor, act, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'
import { WebSocketProvider } from '@/providers/WebSocketProvider'
import { renderWithProviders } from '@/test/render'
import { MockWebSocket, installWebSocketMocks } from '@/test/ws-mock'
import { AppLayout } from '../AppLayout'
import { ProtectedAppLayout } from '../ProtectedAppLayout'
import { Sidebar } from '../Sidebar'
import { Topbar } from '../Topbar'
import { NotificationBell } from '../NotificationBell'

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
  id: 'admin-1',
  email: 'admin@ainrider.com',
  firstName: 'عامر',
  lastName: 'الأدمن',
  fullName: 'عامر الأدمن',
  phoneNumber: '+201001234567',
  role: 'ADMIN' as const,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const notification = {
  id: 'n-1',
  userId: 'admin-1',
  title: 'رحلة جديدة',
  body: 'تمت مطابقة رحلة',
  type: 'PUSH',
  data: null,
  isRead: false,
  createdAt: new Date().toISOString(),
  readAt: null,
}

/** Sets the store as authed inside act and waits for the auth handshake. */
async function connectWebSocket() {
  act(() => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
  })
  let ws: MockWebSocket | undefined
  await waitFor(() => {
    ws = MockWebSocket.last
    expect(ws).toBeDefined()
  })
  ws!.open()
  await waitFor(() => {
    expect(ws!.sent.some((s) => JSON.parse(s).type === 'auth')).toBe(true)
  })
  act(() => {
    ws!.message({ type: 'auth_success' })
  })
  return ws!
}

function stubPendingMe() {
  api.get.mockImplementation((url: string) => {
    if (url === '/auth/me') return new Promise(() => {})
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: null, isAuthenticated: false })
  useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  MockWebSocket.reset()
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.get.mockRejectedValue(new Error('401'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('Sidebar', () => {
  it('renders the brand and all navigation links', () => {
    renderWithProviders(<Sidebar />, { routerProps: { initialEntries: ['/users'] } })
    expect(screen.getByText('عين رايدر — الإدارة')).toBeInTheDocument()
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(10)
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/', '/users', '/trips', '/complaints', '/promos',
      '/vehicles', '/wallets', '/notifications', '/profile', '/settings',
    ])
  })

  it('tints the link on hover and clears it on leave', () => {
    renderWithProviders(<Sidebar />, { routerProps: { initialEntries: ['/users'] } })
    const link = screen.getAllByRole('link')[0] as HTMLElement
    fireEvent.mouseEnter(link)
    expect(link.style.backgroundColor).toBe('var(--color-surface-2)')
    fireEvent.mouseLeave(link)
    expect(link.style.backgroundColor).toBe('transparent')
  })
})

describe('Topbar', () => {
  it('falls back to the generic admin label without a user', () => {
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <Topbar />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    expect(screen.getByText('مستخدم إداري')).toBeInTheDocument()
    expect(screen.getByText('AD')).toBeInTheDocument()
    expect(screen.getByText('دعم فني')).toBeInTheDocument()
  })

  it('shows the user name, initials and ADMIN role label', () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <Topbar />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    expect(screen.getByText('عامر الأدمن')).toBeInTheDocument()
    expect(screen.getByText('عا')).toBeInTheDocument()
    expect(screen.getByText('مدير عام')).toBeInTheDocument()
  })

  it('logs out through the menu', async () => {
    const user = userEvent.setup()
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    api.post.mockResolvedValue({ data: { success: true } })
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <Topbar />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )

    await user.click(screen.getByText('عا'))
    await user.click(await screen.findByText('تسجيل الخروج'))
    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/logout'))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('NotificationBell', () => {
  async function renderBell() {
    installWebSocketMocks(
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
    )
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <NotificationBell />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    return connectWebSocket()
  }

  it('syncs fetched notifications into the store and links to the full list', async () => {
    const user = userEvent.setup()
    stubPendingMe()
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/notifications') {
        return Promise.resolve({ data: [{ ...notification, isRead: true, readAt: new Date().toISOString(), reads: [] }] })
      }
      if (url === '/auth/me') return new Promise(() => {})
      return Promise.reject(new Error(`unexpected ${url}`))
    })
    installWebSocketMocks(
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
    )
    renderWithProviders(
      <WebSocketProvider>
        <NotificationBell />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    await connectWebSocket()

    // the fetched list was synced into the store
    await waitFor(() => expect(useNotificationStore.getState().notifications).toHaveLength(1))
    expect(useNotificationStore.getState().unreadCount).toBe(0)

    await user.click(screen.getByLabelText('الإشعارات'))
    await user.click(await screen.findByText('عرض الكل'))
    // navigation happened within the memory router (bell still mounted, no crash)
    expect(screen.getByText('عرض الكل')).toBeInTheDocument()
  })

  it('shows the offline indicator while disconnected and no badge without unread', async () => {
    const user = userEvent.setup()
    installWebSocketMocks(vi.fn())
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <NotificationBell />
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/'] } },
    )
    await user.click(screen.getByLabelText('الإشعارات'))
    expect(await screen.findByText('غير متصل')).toBeInTheDocument()
    expect(screen.getByText('لا توجد إشعارات')).toBeInTheDocument()
  })

  it('shows an unread badge and the online indicator once connected', async () => {
    const user = userEvent.setup()
    useNotificationStore.setState({ notifications: [notification], unreadCount: 1 })
    await renderBell()

    await user.click(screen.getByLabelText('الإشعارات'))
    expect(await screen.findByText('متصل')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('رحلة جديدة')).toBeInTheDocument()
    expect(screen.getByText('قراءة الكل')).toBeInTheDocument()
  })

  it('caps the badge at 99+', async () => {
    const many = Array.from({ length: 120 }, (_, i) => ({
      ...notification,
      id: `n-${i}`,
      isRead: false,
    }))
    useNotificationStore.setState({ notifications: many, unreadCount: 120 })
    await renderBell()
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('marks a single unread notification as read', async () => {
    const user = userEvent.setup()
    useNotificationStore.setState({ notifications: [notification], unreadCount: 1 })
    api.patch.mockResolvedValue({ data: { success: true } })
    await renderBell()

    await user.click(screen.getByLabelText('الإشعارات'))
    await user.click(await screen.findByText('رحلة جديدة'))
    expect(api.patch).toHaveBeenCalledWith('/admin/notifications/n-1/read')
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('marks all as read', async () => {
    const user = userEvent.setup()
    useNotificationStore.setState({ notifications: [notification], unreadCount: 1 })
    api.patch.mockResolvedValue({ data: { count: 1 } })
    await renderBell()

    await user.click(screen.getByLabelText('الإشعارات'))
    await user.click(await screen.findByText('قراءة الكل'))
    expect(api.patch).toHaveBeenCalledWith('/admin/notifications/read-all')
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('adds realtime notifications and keeps the mark-all button while unread', async () => {
    const user = userEvent.setup()
    const ws = await renderBell()

    act(() => {
      ws.message({
        type: 'notification',
        data: {
          notificationId: 'rt-1',
          userId: 'admin-1',
          title: 'إشعار مباشر',
          body: 'نص الإشعار',
        },
      })
    })
    expect(useNotificationStore.getState().unreadCount).toBe(1)

    await user.click(screen.getByLabelText('الإشعارات'))
    expect(await screen.findByText('إشعار مباشر')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('قراءة الكل')).toBeInTheDocument()

    await user.click(screen.getByText('قراءة الكل'))
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('falls back to a generated id when a realtime notification has none', async () => {
    const ws = await renderBell()

    act(() => {
      ws.message({
        type: 'notification',
        data: { userId: 'admin-1', title: 'بدون معرف', body: 'نص' },
      })
    })
    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(1)
    // no notificationId -> the bell generated one
    expect(state.notifications[0].id).toBeTruthy()
  })
})

describe('AppLayout', () => {
  it('renders the sidebar, topbar and the routed outlet', async () => {
    installWebSocketMocks(
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
    )
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    stubPendingMe()
    renderWithProviders(
      <WebSocketProvider>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route path="users" element={<div>outlet-content</div>} />
          </Route>
        </Routes>
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/users'] } },
    )
    expect(screen.getByText('عين رايدر — الإدارة')).toBeInTheDocument()
    expect(await screen.findByText('outlet-content')).toBeInTheDocument()
  })
})

describe('ProtectedAppLayout', () => {
  it('renders the guarded layout for an authenticated admin', async () => {
    installWebSocketMocks(
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }),
    )
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    api.get.mockResolvedValue({ data: admin })
    renderWithProviders(
      <WebSocketProvider>
        <Routes>
          <Route path="/" element={<ProtectedAppLayout />}>
            <Route path="users" element={<div>guarded-outlet</div>} />
          </Route>
          <Route path="/login" element={<div>login-marker</div>} />
        </Routes>
      </WebSocketProvider>,
      { routerProps: { initialEntries: ['/users'] } },
    )
    expect(await screen.findByText('guarded-outlet')).toBeInTheDocument()
  })
})
