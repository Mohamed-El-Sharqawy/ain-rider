import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor, within, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { NuqsTestingAdapter } from 'nuqs/adapters/testing'
import { UsersPage } from '../UsersPage'
import { UserDetailModal } from '../components/UserDetailModal'
import { CreateUserModal } from '../components/CreateUserModal'
import type { User } from '../services/transformers'

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

const riderDto = {
  id: 'u-1',
  email: 'rider@x.com',
  phoneNumber: '+201001234567',
  firstName: 'أحمد',
  lastName: 'سيد',
  role: 'RIDER',
  status: 'ACTIVE',
  profileImage: 'https://cdn/a.png',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

const statsDto = {
  total: 10,
  byRole: { RIDER: 5, DRIVER: 3, ADMIN: 1, SUPPORT: 1 },
  byStatus: { ACTIVE: 8, INACTIVE: 1, SUSPENDED: 1, BANNED: 0 },
  onlineDrivers: 2,
}

const onboarding = {
  onboardingStatus: 'UNDER_REVIEW',
  documents: {
    identity: { status: 'PENDING', images: [{ url: 'https://cdn/i.png' }] },
    drivingLicense: { status: 'APPROVED', images: [] },
    vehicle: {
      status: 'REJECTED',
      rejectionReason: 'غير واضحة',
      carImage: { url: 'https://cdn/c.png' },
      carLicenseImage: { url: 'https://cdn/l.png' },
    },
  },
}

const riderUser: User = {
  id: 'u-1',
  email: 'rider@x.com',
  phoneNumber: '+201001234567',
  firstName: 'أحمد',
  lastName: 'سيد',
  fullName: 'أحمد سيد',
  role: 'RIDER',
  status: 'ACTIVE',
  profileImage: 'https://cdn/a.png',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
  rating: 4.5,
  totalTrips: 30,
}

const driverUser: User = {
  ...riderUser,
  id: 'u-2',
  role: 'DRIVER',
  profileImage: undefined,
  isOnline: true,
}

const user = userEvent.setup()

function stubUsers() {
  api.get.mockImplementation((url: string) => {
    if (url === '/admin/users') return Promise.resolve({ data: { users: [riderDto], total: 1 } })
    if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
    if (url === '/admin/users/u-2/onboarding-status') return Promise.resolve({ data: { data: onboarding } })
    return Promise.reject(new Error(`unexpected ${url}`))
  })
}

beforeEach(() => {
  localStorage.clear()
  api.get.mockReset()
  api.post.mockReset()
  api.patch.mockReset()
  api.get.mockRejectedValue(new Error('401'))
})

function renderPage(initial = '/users') {
  // The nuqs testing adapter owns the search string (standalone from the router)
  const search = initial.split('?')[1] ? `?${initial.split('?')[1]}` : ''
  renderWithProviders(
    <NuqsTestingAdapter searchParams={search}>
      <UsersPage />
    </NuqsTestingAdapter>,
    { routerProps: { initialEntries: [initial] } },
  )
}

describe('UsersPage', () => {
  it('shows the skeleton while loading', () => {
    api.get.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('renders the error state with retry', async () => {
    renderPage()
    expect(await screen.findByText('فشل تحميل المستخدمين')).toBeInTheDocument()
  })

  it('renders stats cards, filters and the table when loaded', async () => {
    stubUsers()
    renderPage()
    await screen.findByText('أحمد سيد')
    expect(screen.getByText('إجمالي المستخدمين')).toBeInTheDocument()
    expect(screen.getByText('الإداريين')).toBeInTheDocument()
    expect(screen.getAllByText('راكب').length).toBeGreaterThan(0)
    expect(screen.getByText('rider@x.com')).toBeInTheDocument()
  })

  it('opens the create modal and submits a new user', async () => {
    stubUsers()
    api.post.mockResolvedValue({ data: riderDto })
    renderPage()
    await screen.findByText('أحمد سيد')

    await user.click(screen.getByText('إضافة مستخدم'))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('إضافة مستخدم جديد')).toBeInTheDocument()

    await user.type(within(dialog).getByLabelText('الاسم الأول'), 'محمد')
    await user.type(within(dialog).getByLabelText('الاسم الأخير'), 'علي')
    await user.type(within(dialog).getByLabelText('البريد الإلكتروني'), 'm@x.com')
    await user.type(within(dialog).getByLabelText('رقم الهاتف'), '+201112222333')
    await user.type(within(dialog).getByLabelText('كلمة المرور'), 'secret1')
    // pick a role through the select
    fireEvent.click(within(dialog).getByLabelText('الدور'))
    fireEvent.click(await screen.findByText('سائق (Driver)', { selector: '[role="option"] *' }))
    await user.click(within(dialog).getByText('إنشاء المستخدم'))

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/admin/users', {
        email: 'm@x.com',
        phoneNumber: '+201112222333',
        password: 'secret1',
        firstName: 'محمد',
        lastName: 'علي',
        role: 'DRIVER',
      }),
    )
  })

  it('closes the create modal without submitting', async () => {
    stubUsers()
    renderPage()
    await screen.findByText('أحمد سيد')
    await user.click(screen.getByText('إضافة مستخدم'))
    await screen.findByText('إضافة مستخدم جديد')
    await user.click(screen.getByText('إلغاء'))
    await waitFor(() => expect(screen.queryByText('إضافة مستخدم جديد')).not.toBeInTheDocument())
    expect(api.post).not.toHaveBeenCalled()
  })

  it('shows the clear-filters button when search is active and clears it', async () => {
    stubUsers()
    renderPage()
    await screen.findByText('أحمد سيد')
    expect(screen.queryByText('مسح الفلاتر')).not.toBeInTheDocument()

    const searchInput = screen.getByPlaceholderText('بحث بالاسم أو البريد أو الهاتف...')
    // nuqs state is async; a single change event avoids keystroke-value races
    fireEvent.change(searchInput, { target: { value: 'أحمد' } })
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/admin/users',
        expect.objectContaining({ params: expect.objectContaining({ search: 'أحمد' }) }),
      )
    })
    expect(screen.getByText('مسح الفلاتر')).toBeInTheDocument()
    await user.click(screen.getByText('مسح الفلاتر'))
    await waitFor(() => expect(searchInput).toHaveValue(''))
  })

  it('renders the empty state without filters', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { users: [], total: 0 } })
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      return Promise.reject(new Error(url))
    })
    renderPage()
    expect(await screen.findByText('لا يوجد مستخدمون')).toBeInTheDocument()
    expect(screen.getByText('لم يتم تسجيل أي مستخدمين بعد')).toBeInTheDocument()
    expect(screen.queryByText('مسح الفلاتر')).not.toBeInTheDocument()
  })

  it('renders the empty state with a hint when filters are active', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { users: [], total: 0 } })
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      return Promise.reject(new Error(url))
    })
    renderPage('/users?search=غريب')
    expect(await screen.findByText('جرب تغيير معايير البحث')).toBeInTheDocument()
  })

  it('shows the profile-image fallback with the first letter', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users') {
        return Promise.resolve({ data: { users: [{ ...riderDto, profileImage: null }], total: 1 } })
      }
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      return Promise.reject(new Error(url))
    })
    renderPage()
    expect(await screen.findByText('أ')).toBeInTheDocument()
  })

  it('falls back to the raw role label for unknown roles', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users') {
        return Promise.resolve({ data: { users: [{ ...riderDto, role: 'GUEST' }], total: 1 } })
      }
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      return Promise.reject(new Error(url))
    })
    renderPage()
    expect(await screen.findByText('GUEST')).toBeInTheDocument()
  })

  it('filters by role and status through the page selects', async () => {
    stubUsers()
    renderPage()
    await screen.findByText('أحمد سيد')

    // role select (first trigger after the search box)
    const triggers = screen.getAllByRole('combobox')
    fireEvent.click(triggers[0])
    fireEvent.click(await screen.findByText('سائق', { selector: '[role="option"] *' }))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/admin/users',
        expect.objectContaining({ params: expect.objectContaining({ role: 'DRIVER' }) }),
      )
    })

    // status select
    fireEvent.click(triggers[1])
    fireEvent.click(await screen.findByText('محظور', { selector: '[role="option"] *' }))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/admin/users',
        expect.objectContaining({ params: expect.objectContaining({ status: 'BANNED' }) }),
      )
    })
  })

  it('paginates when there are multiple pages', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users') return Promise.resolve({ data: { users: [riderDto], total: 45 } })
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      return Promise.reject(new Error(url))
    })
    renderPage()
    await screen.findByText('أحمد سيد')
    // the standalone Pagination component renders page links; page 1 is active
    const current = await screen.findByText('1', { selector: 'a' })
    expect(current).toHaveAttribute('data-active', 'true')
    expect(screen.getByText('3', { selector: 'a' })).toBeInTheDocument()

    // following a page link refetches with the new page
    await user.click(screen.getByText('2', { selector: 'a' }))
    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith(
        '/admin/users',
        expect.objectContaining({ params: expect.objectContaining({ page: 2 }) }),
      )
    })
  })

  it('opens the detail modal from a row and closes it', async () => {
    stubUsers()
    renderPage()
    await screen.findByText('أحمد سيد')

    await user.click(screen.getByText('أحمد سيد'))
    expect(await screen.findByText('تفاصيل المستخدم')).toBeInTheDocument()
    await user.click(screen.getByText('Close'))
    await waitFor(() => expect(screen.queryByText('تفاصيل المستخدم')).not.toBeInTheDocument())
  })
})

describe('UserDetailModal', () => {
  it('renders rider details with stats and the avatar image', async () => {
    renderWithProviders(<UserDetailModal user={riderUser} open onClose={vi.fn()} />)
    expect(await screen.findByText('تفاصيل المستخدم')).toBeInTheDocument()
    expect(screen.getAllByText('راكب').length).toBeGreaterThan(0)
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('30')).toBeInTheDocument()
    expect(screen.getByText('rider@x.com')).toBeInTheDocument()
  })

  it('falls back to the initial letter without a profile image', async () => {
    renderWithProviders(<UserDetailModal user={driverUser} open onClose={vi.fn()} />)
    await screen.findByText('تفاصيل المستخدم')
    expect(screen.getByText('أ')).toBeInTheDocument()
    expect(screen.getByText('متصل')).toBeInTheDocument()
  })

  it('defaults the role label for unknown roles', async () => {
    renderWithProviders(<UserDetailModal user={{ ...riderUser, role: 'GUEST' }} open onClose={vi.fn()} />)
    await screen.findByText('تفاصيل المستخدم')
    const labels = screen.getAllByText('GUEST')
    expect(labels.length).toBeGreaterThan(0)
  })

  it('labels admin and support roles', async () => {
    const { unmount } = renderWithProviders(<UserDetailModal user={{ ...riderUser, role: 'ADMIN' }} open onClose={vi.fn()} />)
    await screen.findByText('تفاصيل المستخدم')
    expect(screen.getAllByText('مدير').length).toBeGreaterThan(0)
    unmount()

    renderWithProviders(<UserDetailModal user={{ ...riderUser, role: 'SUPPORT' }} open onClose={vi.fn()} />)
    await screen.findByText('تفاصيل المستخدم')
    expect(screen.getAllByText('دعم فني').length).toBeGreaterThan(0)
  })

  it('changes the user status through the inline form', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    renderWithProviders(<UserDetailModal user={riderUser} open onClose={vi.fn()} />)
    await user.click(await screen.findByText('تغيير الحالة'))

    // save is disabled until a status is chosen
    expect(screen.getByText('حفظ')).toBeDisabled()
    await user.click(screen.getByText('حفظ'))
    expect(api.patch).not.toHaveBeenCalled()

    // choose a status and save
    fireEvent.click(screen.getByText('اختر الحالة'))
    fireEvent.click(await screen.findByText('محظور', { selector: '[role="option"] *' }))
    await user.type(screen.getByPlaceholderText('أدخل سبب تغيير الحالة...'), 'مخالفات')
    await user.click(screen.getByText('حفظ'))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/status', {
        status: 'BANNED',
        reason: 'مخالفات',
      }),
    )

    // the form collapses after success
    await waitFor(() => expect(screen.queryByText('اختر الحالة')).not.toBeInTheDocument())
  })

  it('cancels the status form', async () => {
    renderWithProviders(<UserDetailModal user={riderUser} open onClose={vi.fn()} />)
    await user.click(await screen.findByText('تغيير الحالة'))
    await user.click(screen.getByText('إلغاء'))
    await waitFor(() => expect(screen.queryByText('حفظ')).not.toBeInTheDocument())
  })

  it('shows an offline dot for a driver who is not online', async () => {
    renderWithProviders(
      <UserDetailModal user={{ ...driverUser, isOnline: false }} open onClose={vi.fn()} />,
    )
    await screen.findByText('تفاصيل المستخدم')
    expect(screen.getByText('غير متصل')).toBeInTheDocument()
  })

  it('labels the license and vehicle reject stages', async () => {
    const pendingOnboarding = {
      onboardingStatus: 'UNDER_REVIEW',
      documents: {
        identity: { status: 'PENDING', images: [{ url: 'https://cdn/i.png' }] },
        drivingLicense: { status: 'PENDING', images: [{ url: 'https://cdn/l.png' }] },
        vehicle: { status: 'PENDING', images: [{ url: 'https://cdn/c.png' }] },
      },
    }
    api.get.mockResolvedValue({ data: { data: pendingOnboarding } })
    renderWithProviders(<UserDetailModal user={driverUser} open onClose={vi.fn()} />)
    await screen.findByText('مراجعة الوثائق')

    const rejectButtons = screen.getAllByText('رفض')
    expect(rejectButtons).toHaveLength(3)
    await user.click(rejectButtons[0])
    expect(await screen.findByText('رفض الهوية')).toBeInTheDocument()
    await user.click(screen.getByText('إلغاء'))

    await user.click(rejectButtons[1])
    expect(await screen.findByText('رفض الرخصة')).toBeInTheDocument()
    await user.click(screen.getByText('إلغاء'))

    await user.click(rejectButtons[2])
    expect(await screen.findByText('رفض السيارة')).toBeInTheDocument()
  })

  it('saves a status change without a reason', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    renderWithProviders(<UserDetailModal user={riderUser} open onClose={vi.fn()} />)
    await user.click(await screen.findByText('تغيير الحالة'))

    fireEvent.click(screen.getByText('اختر الحالة'))
    fireEvent.click(await screen.findByText('غير نشط', { selector: '[role="option"] *' }))
    await user.click(screen.getByText('حفظ'))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/status', {
        status: 'INACTIVE',
        reason: undefined,
      }),
    )
  })

  it('shows spinners on the approve, reset, reject and status actions while pending', async () => {
    api.get.mockResolvedValue({ data: { data: onboarding } })
    api.patch.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<UserDetailModal user={driverUser} open onClose={vi.fn()} />)
    await screen.findByText('مراجعة الوثائق')

    // approve driver
    await user.click(screen.getByText('قبول السائق نهائياً'))
    expect(
      await screen.findByText('قبول السائق نهائياً', { selector: 'button:disabled' }),
    ).toBeDisabled()
    expect(document.querySelectorAll('.animate-spin').length).toBeGreaterThan(0)

    // reset upload attempts
    await user.click(screen.getByText('إعادة تعيين محاولات الرفع'))
    expect(
      await screen.findByText('إعادة تعيين محاولات الرفع', { selector: 'button:disabled' }),
    ).toBeDisabled()

    // reject a document
    await user.click(screen.getAllByText('رفض')[0])
    await user.type(screen.getByPlaceholderText('أدخل سبب الرفض بالتفصيل ليتمكن السائق من التعديل...'), 'غير مقروءة')
    await user.click(screen.getByText('تأكيد الرفض'))
    expect(
      await screen.findByText('تأكيد الرفض', { selector: 'button:disabled' }),
    ).toBeDisabled()

    // status form save
    await user.click(screen.getByText('تغيير الحالة'))
    fireEvent.click(screen.getByText('اختر الحالة'))
    fireEvent.click(await screen.findByText('محظور', { selector: '[role="option"] *' }))
    await user.type(screen.getByPlaceholderText('أدخل سبب تغيير الحالة...'), 'مخالفات')
    await user.click(screen.getByText('حفظ'))
    expect(await screen.findByText('حفظ', { selector: 'button:disabled' })).toBeDisabled()
    expect(document.querySelectorAll('.animate-spin').length).toBeGreaterThan(0)
  })

  it('shows driver onboarding review actions', async () => {
    api.get.mockResolvedValue({ data: { data: onboarding } })
    api.patch.mockResolvedValue({ data: { success: true } })
    renderWithProviders(<UserDetailModal user={driverUser} open onClose={vi.fn()} />)

    expect(await screen.findByText('مراجعة الوثائق')).toBeInTheDocument()
    expect(screen.getByText('قبول السائق نهائياً')).toBeInTheDocument()
    expect(screen.getByText('إعادة تعيين محاولات الرفع')).toBeInTheDocument()
    // document images render
    const imgs = document.querySelectorAll('img')
    expect(imgs.length).toBe(3)

    // approve the driver
    await user.click(screen.getByText('قبول السائق نهائياً'))
    await waitFor(() => expect(api.patch).toHaveBeenCalledWith('/admin/users/u-2/approve-driver', {}))

    // approve a document (identity stage is the first قبول button)
    await user.click(screen.getAllByText('قبول')[0])
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u-2/approve-document', { stage: 'identity' }),
    )

    // reset the driver's upload attempts
    await user.click(screen.getByText('إعادة تعيين محاولات الرفع'))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u-2/reset-attempts', {}),
    )

    // open reject for a stage, cancel keeps it closed
    await user.click(screen.getAllByText('رفض')[0])
    expect(await screen.findByText('رفض الهوية')).toBeInTheDocument()
    await user.click(screen.getByText('إلغاء'))
    await waitFor(() => expect(screen.queryByText('رفض الهوية')).not.toBeInTheDocument())
  })

  it('submits a document rejection with a reason', async () => {
    api.get.mockResolvedValue({ data: { data: onboarding } })
    api.patch.mockResolvedValue({ data: { success: true } })
    renderWithProviders(<UserDetailModal user={driverUser} open onClose={vi.fn()} />)
    await screen.findByText('مراجعة الوثائق')

    await user.click(screen.getAllByText('رفض')[0])
    const confirm = await screen.findByText('تأكيد الرفض')
    expect(confirm).toBeDisabled()

    await user.type(
      screen.getByPlaceholderText('أدخل سبب الرفض بالتفصيل ليتمكن السائق من التعديل...'),
      'غير مقروءة',
    )
    await user.click(screen.getByText('تأكيد الرفض'))
    await waitFor(() =>
      expect(api.patch).toHaveBeenCalledWith('/admin/users/u-2/reject-document', {
        stage: 'identity',
        reason: 'غير مقروءة',
      }),
    )
  })

  it('renders nothing without a user', () => {
    renderWithProviders(<UserDetailModal user={null} open onClose={vi.fn()} />)
    expect(screen.queryByText('تفاصيل المستخدم')).not.toBeInTheDocument()
  })
})

describe('CreateUserModal', () => {
  it('requires all fields before creating', async () => {
    renderWithProviders(<CreateUserModal open onClose={vi.fn()} />)
    await screen.findByText('إضافة مستخدم جديد')
    // html5 required blocks empty submit
    await user.click(screen.getByText('إنشاء المستخدم'))
    expect(api.post).not.toHaveBeenCalled()
  })

  it('keeps the open state while a creation is pending', async () => {
    api.post.mockReturnValue(new Promise(() => {}))
    renderWithProviders(<CreateUserModal open onClose={vi.fn()} />)
    await screen.findByText('إضافة مستخدم جديد')
    await user.type(screen.getByLabelText('الاسم الأول'), 'م')
    await user.type(screen.getByLabelText('الاسم الأخير'), 'ع')
    await user.type(screen.getByLabelText('البريد الإلكتروني'), 'm@x.com')
    await user.type(screen.getByLabelText('رقم الهاتف'), '+20111')
    await user.type(screen.getByLabelText('كلمة المرور'), 'secret1')
    await user.click(screen.getByText('إنشاء المستخدم'))
    await waitFor(() => expect(api.post).toHaveBeenCalled())
    // pending: cancel button disabled, dialog stays open
    expect(screen.getByText('إلغاء')).toBeDisabled()
    expect(screen.getByText('جاري الإنشاء...')).toBeInTheDocument()

    // a pending creation cannot be dismissed, not even through the close button
    await user.click(screen.getByText('Close'))
    expect(screen.getByText('إضافة مستخدم جديد')).toBeInTheDocument()
  })
})
