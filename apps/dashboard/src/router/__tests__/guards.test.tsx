import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { QueryClient } from '@tanstack/react-query'
import { Routes, Route } from 'react-router'
import { type ReactNode } from 'react'
import { useAuthStore } from '@/stores/authStore'
import { renderWithProviders } from '@/test/render'
import { ProtectedRoute } from '@/components/shared/ProtectedRoute'
import { GuestRoute } from '@/components/shared/GuestRoute'
import { LoginPage } from '@/pages/login/LoginPage'
import { LoginPageGuarded } from '@/router/login-page-guarded'
import { router } from '@/router'

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

/**
 * Guards under test are exercised in isolation (unit seam): each route slot
 * renders its own element, and cross-guard redirect dances are covered by the
 * e2e suite instead.
 */
function renderAt(
  initial: string,
  els: { login?: ReactNode; users?: ReactNode },
  initialEntries?: unknown,
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<div>dashboard-home</div>} />
      <Route path="/login" element={els.login ?? <div>login-marker</div>} />
      <Route path="/users" element={els.users ?? <div>users-marker</div>} />
    </Routes>,
    {
      queryClient,
      routerProps: {
        initialEntries: (initialEntries as MemoryRouterEntries) ?? [initial],
        initialIndex: 0,
      },
    },
  )
}

type MemoryRouterEntries = Array<string | { pathname: string; state?: unknown }>

function guestLogin() {
  return (
    <GuestRoute>
      <LoginPage />
    </GuestRoute>
  )
}

function protectedUsers() {
  return (
    <ProtectedRoute>
      <div>protected-users</div>
    </ProtectedRoute>
  )
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: null, isAuthenticated: false })
  // mockReset (not clearAllMocks): standing implementations must not leak
  // between tests. Default to a rejected me-check = no session.
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.put.mockReset()
  api.delete.mockReset()
  api.get.mockRejectedValue(new Error('401'))
})

describe('GuestRoute at /login', () => {
  it('shows a spinner while the me-check is loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderAt('/login', { login: guestLogin() })
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    expect(api.get).toHaveBeenCalledWith('/auth/me')
    expect(screen.queryByLabelText('البريد الإلكتروني')).not.toBeInTheDocument()
  })

  it('renders the login form for unauthenticated visitors', async () => {
    renderAt('/login', { login: guestLogin() })
    expect(await screen.findByLabelText('البريد الإلكتروني')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('redirects an authenticated user away from the login page', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    renderAt('/login', { login: guestLogin() })
    expect(await screen.findByText('dashboard-home')).toBeInTheDocument()
  })

  it('syncs an ADMIN me-response into the auth store and redirects', async () => {
    api.get.mockResolvedValueOnce({ data: admin })
    renderAt('/login', { login: guestLogin() })
    await screen.findByText('dashboard-home')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('syncs a SUPPORT me-response into the auth store', async () => {
    api.get.mockResolvedValueOnce({ data: { ...admin, role: 'SUPPORT' } })
    renderAt('/login', { login: guestLogin() })
    await screen.findByText('dashboard-home')
    expect(useAuthStore.getState().user?.role).toBe('SUPPORT')
  })

  it('does not sync non-staff roles and keeps the login form', async () => {
    api.get.mockResolvedValueOnce({ data: { ...admin, role: 'RIDER' } })
    renderAt('/login', { login: guestLogin() })
    expect(await screen.findByLabelText('البريد الإلكتروني')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('redirects to the from location for authenticated users', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    renderAt(
      '/login',
      { login: guestLogin() },
      [{ pathname: '/login', state: { from: { pathname: '/users' } } }],
    )
    expect(await screen.findByText('users-marker')).toBeInTheDocument()
  })
})

describe('ProtectedRoute at /users', () => {
  it('shows a spinner while the me-check is loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    renderAt('/users', { users: protectedUsers() })
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText('protected-users')).not.toBeInTheDocument()
  })

  it('renders children for a verified admin session', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    api.get.mockResolvedValue({ data: admin })
    renderAt('/users', { users: protectedUsers() })
    expect(await screen.findByText('protected-users')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('redirects to /login and clears the session when the me-check fails', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    renderAt('/users', { users: protectedUsers() })
    expect(await screen.findByText('login-marker')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })

  it('syncs the session from the me-query and redirects unauthenticated visits', async () => {
    api.get.mockResolvedValue({ data: admin })
    renderAt('/users', { users: protectedUsers() })
    await screen.findByText('login-marker')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('clears an authenticated session for non-staff roles', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    api.get.mockResolvedValue({ data: { ...admin, role: 'RIDER' } })
    renderAt('/users', { users: protectedUsers() })
    expect(await screen.findByText('login-marker')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(errorSpy).toHaveBeenCalledWith('[ProtectedRoute] Invalid role:', 'RIDER')
  })

  it('clears the session on a global auth:unauthorized event', () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    api.get.mockReturnValue(new Promise(() => {}))
    renderAt('/users', { users: protectedUsers() })
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})

describe('GuestRoute used standalone', () => {
  it('keeps guests on the guarded content', async () => {
    renderAt('/login', { login: <GuestRoute><div>guest-content</div></GuestRoute> })
    expect(await screen.findByText('guest-content')).toBeInTheDocument()
  })
})

describe('LoginPageGuarded (the wired /login route)', () => {
  it('shows the login form to guests', async () => {
    renderAt('/login', { login: <LoginPageGuarded /> })
    expect(await screen.findByLabelText('البريد الإلكتروني')).toBeInTheDocument()
  })

  it('bounces authenticated users to their from location', async () => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
    renderAt(
      '/login',
      { login: <LoginPageGuarded /> },
      [{ pathname: '/login', state: { from: { pathname: '/users' } } }],
    )
    expect(await screen.findByText('users-marker')).toBeInTheDocument()
  })
})

describe('router', () => {
  it('registers the guarded login route and the protected layout routes', () => {
    expect(router.routes).toHaveLength(2)
    expect(router.routes[0]?.path).toBe('/login')
    const layout = router.routes[1]
    expect(layout?.path).toBe('/')
    expect(layout?.children).toHaveLength(10)
    expect(layout?.children?.map((c) => c.path ?? 'index')).toEqual([
      'index', 'users', 'trips', 'complaints', 'promos',
      'settings', 'vehicles', 'wallets', 'notifications', 'profile',
    ])
  })
})
