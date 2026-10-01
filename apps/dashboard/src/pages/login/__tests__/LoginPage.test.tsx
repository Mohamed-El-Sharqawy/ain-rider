import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Routes, Route } from 'react-router'
import { renderWithProviders } from '@/test/render'
import { useAuthStore } from '@/stores/authStore'
import { LoginPage } from '../LoginPage'

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
  id: 'admin-1', email: 'admin@ainrider.com', firstName: 'عامر', lastName: 'الأدمن',
  fullName: 'عامر الأدمن', phoneNumber: '+201001234567', role: 'ADMIN' as const,
  status: 'ACTIVE', createdAt: '', updatedAt: '',
}

const user = userEvent.setup()

function renderLogin() {
  // the me-query must fail so GuestRoute keeps the form rendered
  api.get.mockRejectedValue(new Error('401'))
  renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<div>dashboard-home</div>} />
    </Routes>,
    { routerProps: { initialEntries: ['/login'] } },
  )
}

beforeEach(() => {
  localStorage.clear()
  useAuthStore.setState({ user: null, isAuthenticated: false })
  api.get.mockReset()
  api.post.mockReset()
})

describe('LoginPage', () => {
  it('renders the brand, fields and submit button', async () => {
    renderLogin()
    expect(await screen.findByText('عين رايدر — الإدارة')).toBeInTheDocument()
    expect(screen.getByLabelText('البريد الإلكتروني')).toBeInTheDocument()
    expect(screen.getByLabelText('كلمة المرور')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'تسجيل الدخول' })).toBeInTheDocument()
  })

  it('validates empty fields on submit', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByText('البريد الإلكتروني مطلوب')).toBeInTheDocument()
    expect(screen.getByText('كلمة المرور مطلوبة')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('validates the email format and password length', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'not-an-email')
    await user.type(screen.getByLabelText('كلمة المرور'), '123')
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    expect(await screen.findByText('أدخل بريداً إلكترونياً صحيحاً')).toBeInTheDocument()
    expect(screen.getByText('كلمة المرور يجب أن تكون 6 أحرف على الأقل')).toBeInTheDocument()
    expect(api.post).not.toHaveBeenCalled()
  })

  it('clears a field error while typing', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByText('البريد الإلكتروني مطلوب')).toBeInTheDocument()

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'a')
    expect(screen.queryByText('البريد الإلكتروني مطلوب')).not.toBeInTheDocument()
  })

  it('toggles password visibility', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })
    const password = screen.getByLabelText('كلمة المرور')
    expect(password).toHaveAttribute('type', 'password')

    await user.click(password.parentElement!.querySelector('button')!)
    expect(password).toHaveAttribute('type', 'text')
    await user.click(password.parentElement!.querySelector('button')!)
    expect(password).toHaveAttribute('type', 'password')
  })

  it('logs an admin in and navigates home', async () => {
    // mutationFn resolves with the axios response; onSuccess reads response.data.user
    api.post.mockResolvedValue({ data: { user: admin } })
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'admin@ainrider.com')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith(
        '/auth/login',
        { email: 'admin@ainrider.com', password: 'secret1' },
        { withCredentials: true },
      ),
    )
    expect(await screen.findByText('dashboard-home')).toBeInTheDocument()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
  })

  it('rejects non-staff roles with a toast', async () => {
    vi.doMock('sonner', async (importOriginal) => await importOriginal())
    api.post.mockResolvedValue({
      data: { user: { ...admin, role: 'RIDER' } },
    })
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'rider@x.com')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    // the session stays unauthenticated and no navigation happens
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(false))
    expect(screen.queryByText('dashboard-home')).not.toBeInTheDocument()
  })

  it('shows a toast with the api error message on failure', async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: { message: 'بيانات الدخول غير صحيحة' } } },
    })
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'admin@ainrider.com')
    await user.type(screen.getByLabelText('كلمة المرور'), 'wrong!')
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(screen.queryByText('dashboard-home')).not.toBeInTheDocument()
  })

  it('disables the form while the login is pending', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })

    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'admin@ainrider.com')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret1')
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))

    await waitFor(() => expect(api.post).toHaveBeenCalled())
    expect(screen.getByText('جارٍ تسجيل الدخول…')).toBeInTheDocument()
    expect(screen.getByLabelText('البريد الإلكتروني')).toBeDisabled()
  })

  it('tints fields on focus and restores the border on blur', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })
    const email = screen.getByLabelText('البريد الإلكتروني') as HTMLInputElement
    const password = screen.getByLabelText('كلمة المرور') as HTMLInputElement

    email.focus()
    expect(email.style.borderColor).toBe('var(--color-primary)')
    email.blur()
    expect(email.style.borderColor).toBe('var(--color-border)')

    password.focus()
    expect(password.style.borderColor).toBe('var(--color-primary)')
    password.blur()
    expect(password.style.borderColor).toBe('var(--color-border)')
  })

  it('keeps the danger border while a field has a validation error', async () => {
    renderLogin()
    await screen.findByRole('button', { name: 'تسجيل الدخول' })
    await user.click(screen.getByRole('button', { name: 'تسجيل الدخول' }))
    expect(await screen.findByText('البريد الإلكتروني مطلوب')).toBeInTheDocument()
    expect(screen.getByText('كلمة المرور مطلوبة')).toBeInTheDocument()

    const email = screen.getByLabelText('البريد الإلكتروني') as HTMLInputElement
    const password = screen.getByLabelText('كلمة المرور') as HTMLInputElement
    email.focus()
    email.blur()
    // the errored field must keep its danger styling: focus/blur must not restyle it
    expect(email.style.borderColor).not.toBe('var(--color-primary)')
    expect(email.style.borderColor).not.toBe('var(--color-border)')

    password.focus()
    password.blur()
    expect(password.style.borderColor).not.toBe('var(--color-primary)')
    expect(password.style.borderColor).not.toBe('var(--color-border)')
  })
})
