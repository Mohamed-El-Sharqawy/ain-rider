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

import { promosApi } from '../services/api'
import { useGetPromos, useGetPromoByCode, promoKeys } from '../services/queries'
import { useCreatePromo, useUpdatePromo } from '../services/mutations'
import { transformPromo } from '../services/transformers'
import { usePromoFilters } from '../hooks/usePromoFilters'

const promoDto = {
  id: 'p-1', code: 'SUMMER2026', type: 'PERCENTAGE', value: 20,
  maxUsagePerUser: 2, totalUsageLimit: 100, currentUsageCount: 7,
  status: 'ACTIVE', validFrom: '2026-01-01T00:00:00Z', validUntil: '2026-12-31T00:00:00Z',
  description: 'خصم الصيف', createdBy: 'admin', createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
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

describe('promosApi', () => {
  it('calls the right endpoints', () => {
    promosApi.getAll('ACTIVE')
    expect(api.get).toHaveBeenCalledWith('/admin/promos', { params: { status: 'ACTIVE' } })
    promosApi.getByCode('SUMMER')
    expect(api.get).toHaveBeenCalledWith('/admin/promos/SUMMER')
    promosApi.create({ code: 'X' } as never)
    expect(api.post).toHaveBeenCalledWith('/admin/promos', { code: 'X' })
    promosApi.update('p-1', { status: 'INACTIVE' })
    expect(api.patch).toHaveBeenCalledWith('/admin/promos/p-1', { status: 'INACTIVE' })
  })
})

describe('transformers', () => {
  it('passes the promo through', () => {
    const promo = transformPromo(promoDto)
    expect(promo.code).toBe('SUMMER2026')
    expect(promo.maxDiscount).toBeUndefined()
  })
})

describe('queries', () => {
  it('fetches lists and skips empty codes', async () => {
    api.get.mockResolvedValue({ data: [promoDto] })
    const { wrapper } = makeWrapper()
    const { result: list } = renderHook(() => useGetPromos(), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    expect(list.current.data?.[0].code).toBe('SUMMER2026')

    const { result: idle } = renderHook(() => useGetPromoByCode(''), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')

    const { result: detail } = renderHook(() => useGetPromoByCode('SUMMER2026'), { wrapper })
    await waitFor(() => expect(detail.current.isSuccess).toBe(true))
    expect(promoKeys.detail('SUMMER2026')).toEqual(['promos', 'detail', 'SUMMER2026'])
  })
})

describe('mutations', () => {
  it('creates promos with success and error toasts', async () => {
    api.post.mockResolvedValueOnce({ data: promoDto })
    api.post.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 409, data: { error: { message: 'الكود مستخدم' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useCreatePromo(), { wrapper })
    act(() => result.current.mutate({ code: 'SUMMER2026' } as never))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم إنشاء العرض الترويجي بنجاح')

    act(() => result.current.mutate({ code: 'SUMMER2026' } as never))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('الكود مستخدم')
  })

  it('optimistically updates lists and rolls back on failure', async () => {
    const existing = transformPromo(promoDto)
    const other = transformPromo({ ...promoDto, id: 'p-2', code: 'WINTER2026' })
    api.patch.mockResolvedValueOnce({ data: promoDto })
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'مرفوض' } } },
    })
    const { wrapper, queryClient } = makeWrapper()
    queryClient.setQueryData(promoKeys.list(undefined), [existing, other])
    const { result } = renderHook(() => useUpdatePromo(), { wrapper })

    act(() => result.current.mutate({ id: 'p-1', data: { status: 'INACTIVE' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    const list = queryClient.getQueryData<{ id: string; status: string }[]>(promoKeys.list(undefined))
    // only the matching promo changed
    expect(list?.[0].status).toBe('INACTIVE')
    expect(list?.[1].status).toBe('ACTIVE')
    expect(toast.success).toHaveBeenCalledWith('تم تحديث العرض الترويجي بنجاح')

    act(() => result.current.mutate({ id: 'p-1', data: { status: 'ACTIVE' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    const rolled = queryClient.getQueryData<{ id: string; status: string }[]>(promoKeys.list(undefined))
    expect(rolled?.[0].status).toBe('INACTIVE')
    expect(toast.error).toHaveBeenCalledWith('مرفوض')
  })

  it('leaves a pending list query untouched during the optimistic update', async () => {
    api.get.mockReturnValue(new Promise(() => {}))
    api.patch.mockResolvedValue({ data: promoDto })
    const { wrapper, queryClient } = makeWrapper()
    const { result: list } = renderHook(() => useGetPromos(), { wrapper })
    await waitFor(() => expect(list.current.fetchStatus).toBe('fetching'))

    const { result } = renderHook(() => useUpdatePromo(), { wrapper })
    act(() => result.current.mutate({ id: 'p-1', data: { status: 'INACTIVE' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(queryClient.getQueryData(promoKeys.list(undefined))).toBeUndefined()
  })

  it('errors without crashing when no lists are cached', async () => {
    api.patch.mockRejectedValue(new Error('network'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpdatePromo(), { wrapper })
    act(() => result.current.mutate({ id: 'p-404', data: { status: 'INACTIVE' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalled()
  })
})

describe('usePromoFilters', () => {
  it('defaults to all and clears', async () => {
    const { result } = renderHook(() => usePromoFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    })
    expect(result.current.filters.status).toBeUndefined()
    await act(async () => {
      await result.current.setStatus('ACTIVE')
    })
    await waitFor(() => expect(result.current.filters.status).toBe('ACTIVE'))
    await act(async () => {
      await result.current.clearFilters()
    })
    await waitFor(() => expect(result.current.filters.status).toBeUndefined())
  })
})
