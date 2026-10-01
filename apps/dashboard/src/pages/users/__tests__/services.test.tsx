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

import { usersApi } from '../services/api'
import {
  useGetOnboardingStatus,
  useGetAllUsers,
  useGetUserById,
  useGetUserStats,
  userKeys,
} from '../services/queries'
import {
  useUpdateUserStatus,
  useCreateUser,
  useApproveDriver,
  useRejectDocument,
  useApproveDocument,
  useResetUploadAttempts,
} from '../services/mutations'
import {
  transformUser,
  transformUserStats,
  transformPaginatedUsers,
} from '../services/transformers'
import { useUserFilters } from '../hooks/useUserFilters'

const userDto = {
  id: 'u-1',
  email: 'rider@x.com',
  phoneNumber: '+201001234567',
  firstName: 'أحمد',
  lastName: 'سيد',
  role: 'RIDER' as const,
  status: 'ACTIVE' as const,
  profileImage: 'https://cdn/a.png',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  roleData: { rating: 4.5, totalTrips: 30 },
}

const statsDto = {
  total: 10,
  byRole: { RIDER: 5, DRIVER: 3, ADMIN: 1, SUPPORT: 1 },
  byStatus: { ACTIVE: 8, INACTIVE: 1, SUSPENDED: 1, BANNED: 0 },
  onlineDrivers: 2,
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

describe('usersApi', () => {
  it('calls the right endpoints', () => {
    usersApi.getAll({ role: 'RIDER', page: 1 })
    expect(api.get).toHaveBeenCalledWith('/admin/users', { params: { role: 'RIDER', page: 1 } })
    usersApi.getById('u-1')
    expect(api.get).toHaveBeenCalledWith('/admin/users/u-1')
    usersApi.getStats()
    expect(api.get).toHaveBeenCalledWith('/admin/users/stats')
    usersApi.getOnboardingStatus('u-1')
    expect(api.get).toHaveBeenCalledWith('/admin/users/u-1/onboarding-status')
    usersApi.updateStatus('u-1', { status: 'BANNED' })
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/status', { status: 'BANNED' })
    usersApi.approveDriver('u-1')
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/approve-driver', {})
    usersApi.rejectDocument('u-1', 'identity', 'غير مقروءة')
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/reject-document', {
      stage: 'identity',
      reason: 'غير مقروءة',
    })
    usersApi.approveDocument('u-1', 'license')
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/approve-document', { stage: 'license' })
    usersApi.create({ email: 'a@b.c', phoneNumber: '+20', password: 'secret1', firstName: 'أ', lastName: 'ب', role: 'RIDER' })
    expect(api.post).toHaveBeenCalledWith('/admin/users', {
      email: 'a@b.c', phoneNumber: '+20', password: 'secret1', firstName: 'أ', lastName: 'ب', role: 'RIDER',
    })
    usersApi.resetUploadAttempts('u-1')
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/reset-attempts', {})
  })
})

describe('transformers', () => {
  it('transforms a rider with roleData', () => {
    const user = transformUser(userDto)
    expect(user.fullName).toBe('أحمد سيد')
    expect(user.rating).toBe(4.5)
    expect(user.totalTrips).toBe(30)
    expect(user.licenseNumber).toBeUndefined()
  })

  it('transforms a driver including license fields', () => {
    const user = transformUser({
      ...userDto,
      role: 'DRIVER',
      roleData: {
        id: 'd-1', userId: 'u-1', licenseNumber: 'LIC-9', rating: 4.9, totalTrips: 120, isOnline: true,
        createdAt: '', updatedAt: '',
      },
    })
    expect(user.licenseNumber).toBe('LIC-9')
    expect(user.isOnline).toBe(true)
  })

  it('drops a null profile image', () => {
    const user = transformUser({ ...userDto, profileImage: null })
    expect(user.profileImage).toBeUndefined()
  })

  it('defaults missing role stats to zero', () => {
    const stats = transformUserStats({ total: 3, byRole: {}, byStatus: {}, onlineDrivers: 0 })
    expect(stats.riders).toBe(0)
    expect(stats.banned).toBe(0)
  })

  it('transforms both pagination shapes', () => {
    const modern = transformPaginatedUsers({ users: [userDto], total: 51 })
    expect(modern.meta.totalPages).toBe(3)
    const legacy = transformPaginatedUsers({
      data: [userDto],
      meta: { total: 40, page: 2, limit: 20, totalPages: 2 },
    })
    expect(legacy.meta.totalPages).toBe(2)
  })
})

describe('queries', () => {
  it('fetches the list through the gateway shape', async () => {
    api.get.mockResolvedValue({ data: { users: [userDto], total: 1 } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetAllUsers({ page: 1 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data[0].fullName).toBe('أحمد سيد')
  })

  it('skips the detail + onboarding queries without an id', () => {
    const { wrapper } = makeWrapper()
    const { result: r1 } = renderHook(() => useGetUserById(''), { wrapper })
    expect(r1.current.fetchStatus).toBe('idle')
    const { result: r2 } = renderHook(() => useGetOnboardingStatus(''), { wrapper })
    expect(r2.current.fetchStatus).toBe('idle')
  })

  it('fetches detail, stats and onboarding', async () => {
    const onboarding = {
      onboardingStatus: 'UNDER_REVIEW',
      documents: {
        identity: { status: 'PENDING', images: [{ url: 'https://cdn/i.png' }] },
        drivingLicense: { status: 'APPROVED', images: [] },
        vehicle: { status: 'REJECTED', rejectionReason: 'غير واضحة', carImage: { url: 'https://cdn/c.png' }, carLicenseImage: { url: 'https://cdn/l.png' } },
      },
    }
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/users/stats') return Promise.resolve({ data: statsDto })
      if (url === '/admin/users/u-1') return Promise.resolve({ data: userDto })
      if (url === '/admin/users/u-1/onboarding-status') return Promise.resolve({ data: { data: onboarding } })
      return Promise.reject(new Error(url))
    })
    const { wrapper } = makeWrapper()
    const { result: detail } = renderHook(() => useGetUserById('u-1'), { wrapper })
    const { result: stats } = renderHook(() => useGetUserStats(), { wrapper })
    const { result: onb } = renderHook(() => useGetOnboardingStatus('u-1'), { wrapper })
    await waitFor(() => expect(onb.current.isSuccess).toBe(true))
    await waitFor(() => expect(detail.current.isSuccess).toBe(true))
    await waitFor(() => expect(stats.current.isSuccess).toBe(true))
    expect(onb.current.data?.onboardingStatus).toBe('UNDER_REVIEW')
    expect(userKeys.detail('u-1')).toEqual(['users', 'detail', 'u-1'])
  })
})

describe('mutations', () => {
  it('updates status with invalidations and a toast', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    const { wrapper, queryClient } = makeWrapper()
    const spy = vi.spyOn(queryClient, 'invalidateQueries')
    const { result } = renderHook(() => useUpdateUserStatus(), { wrapper })
    act(() => result.current.mutate({ id: 'u-1', data: { status: 'BANNED', reason: 'سبام' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(spy).toHaveBeenCalledWith({ queryKey: userKeys.all })
    expect(toast.success).toHaveBeenCalledWith('تم تحديث حالة المستخدم بنجاح')
  })

  it('creates a user', async () => {
    api.post.mockResolvedValue({ data: userDto })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateUser(), { wrapper })
    act(() =>
      result.current.mutate({
        email: 'a@b.c', phoneNumber: '+20', password: 'secret1', firstName: 'أ', lastName: 'ب', role: 'RIDER',
      }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء المستخدم بنجاح')
  })

  it('approves a driver', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useApproveDriver(), { wrapper })
    act(() => result.current.mutate('u-1'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم قبول السائق بنجاح')
  })

  it('rejects and approves documents', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    const { wrapper } = makeWrapper()
    const { result: reject } = renderHook(() => useRejectDocument(), { wrapper })
    const { result: approve } = renderHook(() => useApproveDocument(), { wrapper })
    act(() => reject.current.mutate({ id: 'u-1', stage: 'identity', reason: 'غير مقروءة' }))
    await waitFor(() => expect(reject.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم رفض الوثيقة مع إرسال السبب')
    act(() => approve.current.mutate({ id: 'u-1', stage: 'license' }))
    await waitFor(() => expect(approve.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم قبول الوثيقة بنجاح')
  })

  it('resets upload attempts and toasts mutation errors', async () => {
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'مرفوض' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useResetUploadAttempts(), { wrapper })
    act(() => result.current.mutate('u-1'))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('مرفوض')
  })

  it('resets upload attempts successfully', async () => {
    api.patch.mockResolvedValue({ data: { success: true } })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useResetUploadAttempts(), { wrapper })
    act(() => result.current.mutate('u-1'))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(api.patch).toHaveBeenCalledWith('/admin/users/u-1/reset-attempts', {})
    expect(toast.success).toHaveBeenCalledWith('تم إعادة تعيين محاولات الرفع بنجاح')
  })

  it('toasts the api error for every failing admin action', async () => {
    api.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 403, data: { error: { message: 'غير مصرح' } } },
    })
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'البريد مستخدم' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: status } = renderHook(() => useUpdateUserStatus(), { wrapper })
    const { result: create } = renderHook(() => useCreateUser(), { wrapper })
    const { result: approveDriver } = renderHook(() => useApproveDriver(), { wrapper })
    const { result: reject } = renderHook(() => useRejectDocument(), { wrapper })
    const { result: approve } = renderHook(() => useApproveDocument(), { wrapper })

    act(() => status.current.mutate({ id: 'u-1', data: { status: 'BANNED' } }))
    await waitFor(() => expect(status.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير مصرح')

    act(() => approveDriver.current.mutate('u-1'))
    await waitFor(() => expect(approveDriver.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير مصرح')

    act(() => reject.current.mutate({ id: 'u-1', stage: 'identity', reason: 'سبب' }))
    await waitFor(() => expect(reject.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير مصرح')

    act(() => approve.current.mutate({ id: 'u-1', stage: 'identity' }))
    await waitFor(() => expect(approve.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير مصرح')

    act(() =>
      create.current.mutate({
        email: 'a@b.c', phoneNumber: '+20', password: 'secret1', firstName: 'أ', lastName: 'ب', role: 'RIDER',
      }),
    )
    await waitFor(() => expect(create.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('البريد مستخدم')
  })
})

describe('useUserFilters', () => {
  it('maps all-roles/status to undefined and clears', async () => {
    const { result } = renderHook(() => useUserFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={new QueryClient()}>
          <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
        </QueryClientProvider>
      ),
    })
    expect(result.current.filters.role).toBeUndefined()
    expect(result.current.filters.search).toBeUndefined()

    act(() => {
      result.current.setFilters({ role: 'RIDER', search: 'أحمد', page: 2 })
    })
    await waitFor(() => expect(result.current.rawFilters.role).toBe('RIDER'))
    expect(result.current.filters.role).toBe('RIDER')
    expect(result.current.filters.search).toBe('أحمد')

    act(() => {
      result.current.clearFilters()
    })
    await waitFor(() => expect(result.current.rawFilters.role).toBe('all'))
  })
})
