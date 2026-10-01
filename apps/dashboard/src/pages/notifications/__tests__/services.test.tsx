import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/authStore'

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

import { notificationsApi } from '../services/api'
import {
  useGetAllNotifications,
  useGetMyNotifications,
  useGetUserNotifications,
  notificationKeys,
} from '../services/queries'
import {
  useCreateNotification,
  useSendPush,
  useSendSms,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '../services/mutations'
import { transformNotification } from '../services/transformers'

const dto = {
  id: 'n-1', userId: 'u-1', title: 'عنوان', body: 'نص', type: 'PUSH', data: null,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
  readAt: '2026-01-02T00:00:00Z',
  reads: [{ readerId: 'admin-1', readAt: '2026-01-02T00:00:00Z' }],
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
  useAuthStore.setState({ user: null, isAuthenticated: false })
})

describe('notificationsApi', () => {
  it('calls the right endpoints', () => {
    notificationsApi.getAll()
    expect(api.get).toHaveBeenCalledWith('/admin/notifications')
    notificationsApi.getMyNotifications()
    expect(api.get).toHaveBeenCalledWith('/admin/notifications/me')
    notificationsApi.getByUser('u-1')
    expect(api.get).toHaveBeenCalledWith('/admin/notifications/user/u-1')
    notificationsApi.create({ userId: 'u-1', title: 't', body: 'b' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/notifications', { userId: 'u-1', title: 't', body: 'b' })
    notificationsApi.sendPush({ userId: 'u-1', title: 't', body: 'b' })
    expect(api.post).toHaveBeenCalledWith('/admin/notifications/push', { userId: 'u-1', title: 't', body: 'b' })
    notificationsApi.sendSms({ phoneNumber: '+20', message: 'm' })
    expect(api.post).toHaveBeenCalledWith('/admin/notifications/sms', { phoneNumber: '+20', message: 'm' })
    notificationsApi.markRead('n-1')
    expect(api.patch).toHaveBeenCalledWith('/admin/notifications/n-1/read')
    notificationsApi.markAllAsRead()
    expect(api.patch).toHaveBeenCalledWith('/admin/notifications/read-all')
  })
})

describe('transformNotification', () => {
  it('uses the reads array when a current user is provided', () => {
    const n = transformNotification(dto, 'admin-1')
    expect(n.isRead).toBe(true)
    expect(n.readAt).toBe('2026-01-02T00:00:00Z')
  })

  it('falls back to readAt without a current user', () => {
    const n = transformNotification({ ...dto, reads: [] }, undefined)
    expect(n.isRead).toBe(true)
    expect(n.readAt).toBe('2026-01-02T00:00:00Z')
  })

  it('marks unread when the current user has no read record', () => {
    const n = transformNotification({ ...dto, reads: [] }, 'admin-1')
    expect(n.isRead).toBe(false)
    expect(n.readAt).toBe('2026-01-02T00:00:00Z')
  })

  it('defaults a missing userId', () => {
    const n = transformNotification({ ...dto, userId: undefined as never }, undefined)
    expect(n.userId).toBe('')
  })
})

describe('queries', () => {
  it('fetches all, mine and by-user lists', async () => {
    api.get.mockResolvedValue({ data: [dto] })
    const { wrapper } = makeWrapper()
    const { result: all } = renderHook(() => useGetAllNotifications(), { wrapper })
    const { result: my } = renderHook(() => useGetMyNotifications(), { wrapper })
    const { result: byUser } = renderHook(() => useGetUserNotifications('u-1'), { wrapper })
    const { result: idle } = renderHook(() => useGetUserNotifications(''), { wrapper })
    await waitFor(() => expect(all.current.isSuccess).toBe(true))
    await waitFor(() => expect(my.current.isSuccess).toBe(true))
    await waitFor(() => expect(byUser.current.isSuccess).toBe(true))
    expect(idle.current.fetchStatus).toBe('idle')
    expect(all.current.data?.[0].title).toBe('عنوان')
    expect(notificationKeys.me()).toEqual(['notifications', 'me'])
  })
})

describe('mutations', () => {
  it('creates a notification and invalidates the user list', async () => {
    api.post.mockResolvedValueOnce({ data: dto })
    api.post.mockRejectedValueOnce(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateNotification(), { wrapper })
    act(() => result.current.mutate({ userId: 'u-1', title: 't', body: 'b' } as never))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء الإشعار بنجاح')
    act(() => result.current.mutate({ userId: 'u-1', title: 't', body: 'b' } as never))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('x')
  })

  it('sends push and sms with toasts', async () => {
    api.post.mockResolvedValue({ data: dto })
    const { wrapper } = makeWrapper()
    const { result: push } = renderHook(() => useSendPush(), { wrapper })
    const { result: sms } = renderHook(() => useSendSms(), { wrapper })
    act(() => push.current.mutate({ userId: 'u-1', title: 't', body: 'b' }))
    await waitFor(() => expect(push.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إرسال الإشعار بنجاح')
    act(() => sms.current.mutate({ phoneNumber: '+20', message: 'm' }))
    await waitFor(() => expect(sms.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إرسال الرسالة النصية بنجاح')
  })

  it('toasts the api error when push or sms sending fails', async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 502, data: { error: { message: 'بوابة الإشعارات معطلة' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: push } = renderHook(() => useSendPush(), { wrapper })
    const { result: sms } = renderHook(() => useSendSms(), { wrapper })

    act(() => push.current.mutate({ userId: 'u-1', title: 't', body: 'b' }))
    await waitFor(() => expect(push.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('بوابة الإشعارات معطلة')

    act(() => sms.current.mutate({ phoneNumber: '+20', message: 'm' }))
    await waitFor(() => expect(sms.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('بوابة الإشعارات معطلة')
  })

  it('toasts the api error when marking all as read fails', async () => {
    api.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 500, data: { error: { message: 'فشل الخادم' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useMarkAllNotificationsRead(), { wrapper })
    act(() => result.current.mutate())
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('فشل الخادم')
  })

  it('marks one and all as read with toasts on errors', async () => {
    api.patch.mockResolvedValueOnce({ data: dto })
    api.patch.mockResolvedValueOnce({ data: { count: 1 } })
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'مرفوض' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: one } = renderHook(() => useMarkNotificationRead(), { wrapper })
    const { result: allM } = renderHook(() => useMarkAllNotificationsRead(), { wrapper })

    act(() => one.current.mutate('n-1'))
    await waitFor(() => expect(one.current.isSuccess).toBe(true))

    act(() => allM.current.mutate())
    await waitFor(() => expect(allM.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديد جميع الإشعارات كمقروءة')

    act(() => one.current.mutate('n-1'))
    await waitFor(() => expect(one.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('مرفوض')
  })
})
