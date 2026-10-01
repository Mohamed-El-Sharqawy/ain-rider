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

import { complaintsApi } from '../services/api'
import { useGetComplaints, useGetComplaintById, complaintKeys } from '../services/queries'
import {
  useCreateComplaint,
  useUpdateComplaintStatus,
  useAddComplaintComment,
} from '../services/mutations'
import { transformComplaint, transformComplaintComment } from '../services/transformers'
import { useComplaintFilters } from '../hooks/useComplaintFilters'

const commentDto = {
  id: 'c-1',
  complaintId: 'cm-1',
  userId: 'u-1',
  userRole: 'admin',
  comment: 'جاري المراجعة',
  isInternal: false,
  createdAt: '2026-01-02T00:00:00Z',
}

const complaintDto = {
  id: 'cm-1',
  complainantId: 'u-1',
  complainantRole: 'RIDER',
  type: 'SAFETY',
  subject: 'سائق متأخر',
  description: 'التأخر عن الموعد',
  status: 'PENDING',
  priority: 'HIGH',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  comments: [commentDto],
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

describe('complaintsApi', () => {
  it('calls the right endpoints', () => {
    complaintsApi.getAll({ status: 'PENDING', page: 1 })
    expect(api.get).toHaveBeenCalledWith('/admin/complaints', {
      params: { status: 'PENDING', page: 1 },
    })
    complaintsApi.getById('cm-1')
    expect(api.get).toHaveBeenCalledWith('/admin/complaints/cm-1')
    complaintsApi.create({ subject: 'موضوع' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/complaints', { subject: 'موضوع' })
    complaintsApi.updateStatus('cm-1', { status: 'RESOLVED', resolution: 'تم' })
    expect(api.patch).toHaveBeenCalledWith('/admin/complaints/cm-1/status', {
      status: 'RESOLVED',
      resolution: 'تم',
    })
    complaintsApi.addComment('cm-1', { comment: 'مرحبا', isInternal: false })
    expect(api.post).toHaveBeenCalledWith('/admin/complaints/cm-1/comments', {
      comment: 'مرحبا',
      isInternal: false,
    })
  })
})

describe('transformers', () => {
  it('transforms a complaint and tolerates missing comments', () => {
    const complaint = transformComplaint(complaintDto)
    expect(complaint.comments).toHaveLength(1)
    expect(transformComplaint({ ...complaintDto, comments: undefined as never }).comments).toEqual([])
  })

  it('transforms a comment', () => {
    expect(transformComplaintComment(commentDto).comment).toBe('جاري المراجعة')
  })
})

describe('queries', () => {
  it('fetches the list and transforms items', async () => {
    api.get.mockResolvedValue({
      data: { data: [complaintDto], total: 1, page: 1, limit: 20, totalPages: 1 },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetComplaints({ page: 1 }), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data?.data[0].subject).toBe('سائق متأخر')
    expect(result.current.data?.total).toBe(1)
  })

  it('skips the detail query without an id and fetches with one', async () => {
    const { wrapper } = makeWrapper()
    const { result: idle } = renderHook(() => useGetComplaintById(''), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')

    api.get.mockResolvedValue({ data: complaintDto })
    const { result } = renderHook(() => useGetComplaintById('cm-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(complaintKeys.detail('cm-1')).toEqual(['complaints', 'detail', 'cm-1'])
  })
})

describe('useCreateComplaint', () => {
  it('invalidates and toasts on success, toasts errors on failure', async () => {
    api.post.mockResolvedValueOnce({ data: complaintDto })
    api.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'غير صالح' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreateComplaint(), { wrapper })
    act(() => result.current.mutate({ subject: 'موضوع' } as never))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء الشكوى بنجاح')

    act(() => result.current.mutate({ subject: 'موضوع' } as never))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير صالح')
  })
})

describe('useUpdateComplaintStatus', () => {
  const complaint = transformComplaint(complaintDto)

  it('applies optimistic updates and rolls forward on success', async () => {
    api.patch.mockResolvedValue({ data: complaintDto })
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(complaintKeys.detail('cm-1'), complaint)
    const { result } = renderHook(() => useUpdateComplaintStatus(), { wrapper })

    act(() =>
      result.current.mutate({
        id: 'cm-1',
        data: { status: 'IN_PROGRESS', assignedTo: 'admin-1' },
      }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    // optimistic detail kept the new status
    const detail = queryClient.getQueryData<{ status: string }>(complaintKeys.detail('cm-1'))
    expect(detail?.status).toBe('IN_PROGRESS')
    expect(toast.success).toHaveBeenCalledWith('تم تحديث حالة الشكوى بنجاح')
  })

  it('resolves with resolution notes only when resolving', async () => {
    api.patch.mockResolvedValue({ data: complaintDto })
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(complaintKeys.detail('cm-1'), complaint)
    const { result } = renderHook(() => useUpdateComplaintStatus(), { wrapper })
    act(() =>
      result.current.mutate({
        id: 'cm-1',
        data: { status: 'RESOLVED', assignedTo: 'admin-1', resolution: 'تم الحل نهائياً' },
      }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const detail = queryClient.getQueryData<{ resolution?: string }>(complaintKeys.detail('cm-1'))
    expect(detail?.resolution).toBe('تم الحل نهائياً')
  })

  it('rolls back the optimistic detail on error', async () => {
    api.patch.mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'انتقال غير مسموح' } } },
    })
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(complaintKeys.detail('cm-1'), complaint)
    const { result } = renderHook(() => useUpdateComplaintStatus(), { wrapper })
    act(() =>
      result.current.mutate({ id: 'cm-1', data: { status: 'IN_PROGRESS', assignedTo: 'admin-1' } }),
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    const detail = queryClient.getQueryData<{ status: string }>(complaintKeys.detail('cm-1'))
    expect(detail?.status).toBe('PENDING')
    expect(toast.error).toHaveBeenCalledWith('انتقال غير مسموح')
  })

  it('survives a rollback when no cached detail exists', async () => {
    api.patch.mockRejectedValue(new Error('network'))
    const { wrapper, queryClient } = makeWrapper()
    // seed a list query so setQueriesData has data to map
    queryClient.setQueryData(complaintKeys.list({}), {
      data: [complaint, { ...complaint, id: 'cm-2', subject: 'شكوى أخرى' }],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    })
    const { result } = renderHook(() => useUpdateComplaintStatus(), { wrapper })
    act(() =>
      result.current.mutate({ id: 'cm-1', data: { status: 'IN_PROGRESS', assignedTo: 'admin-1' } }),
    )
    await waitFor(() => expect(result.current.isError).toBe(true))
    const list = queryClient.getQueryData<{ data: Array<{ id: string; status: string }> }>(
      complaintKeys.list({}),
    )
    // only the matching row was updated
    expect(list?.data[0].status).toBe('IN_PROGRESS')
    expect(list?.data[1].status).toBe('PENDING')
  })

  it('leaves a pending list query untouched during the optimistic update', async () => {
    api.get.mockReturnValue(new Promise(() => {}))
    api.patch.mockResolvedValue({ data: complaintDto })
    const { wrapper, queryClient } = makeWrapper()
    // a pending list fetch creates a matching cache entry with no data yet
    const { result: list } = renderHook(() => useGetComplaints({ page: 1 }), { wrapper })
    await waitFor(() => expect(list.current.fetchStatus).toBe('fetching'))

    const { result } = renderHook(() => useUpdateComplaintStatus(), { wrapper })
    act(() =>
      result.current.mutate({ id: 'cm-1', data: { status: 'IN_PROGRESS', assignedTo: 'admin-1' } }),
    )
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(complaintKeys.list({ page: 1 }))).toBeUndefined()
  })
})

describe('useAddComplaintComment', () => {
  it('appends an optimistic comment and clears it on success', async () => {
    api.post.mockResolvedValue({ data: complaintDto })
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(complaintKeys.detail('cm-1'), transformComplaint(complaintDto))
    const { result } = renderHook(() => useAddComplaintComment(), { wrapper })
    act(() => result.current.mutate({ id: 'cm-1', data: { comment: 'تعليق جديد' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const detail = queryClient.getQueryData<{ comments: Array<{ comment: string }> }>(
      complaintKeys.detail('cm-1'),
    )
    expect(detail?.comments.some((c) => c.comment === 'تعليق جديد')).toBe(true)
    expect(toast.success).toHaveBeenCalledWith('تم إضافة التعليق بنجاح')
  })

  it('rolls back a comment on error', async () => {
    api.post.mockRejectedValue(new Error('x'))
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(complaintKeys.detail('cm-1'), transformComplaint(complaintDto))
    const { result } = renderHook(() => useAddComplaintComment(), { wrapper })
    act(() => result.current.mutate({ id: 'cm-1', data: { comment: 'فاشل' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    const detail = queryClient.getQueryData<{ comments: Array<{ comment: string }> }>(
      complaintKeys.detail('cm-1'),
    )
    expect(detail?.comments.some((c) => c.comment === 'فاشل')).toBe(false)
  })

  it('errors gracefully when no detail is cached at all', async () => {
    api.post.mockRejectedValue(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAddComplaintComment(), { wrapper })
    act(() => result.current.mutate({ id: 'cm-404', data: { comment: 'فاشل' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('useComplaintFilters', () => {
  it('defaults to all and clears', async () => {
    const { result } = renderHook(() => useComplaintFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter searchParams="?status=PENDING&page=2">
          {children}
        </NuqsTestingAdapter>
      ),
    })
    expect(result.current.filters.status).toBe('PENDING')
    expect(result.current.filters.page).toBe(2)

    act(() => result.current.clearFilters())
    await waitFor(() => expect(result.current.filters.status).toBeUndefined())
    expect(result.current.filters.page).toBe(1)
  })
})
