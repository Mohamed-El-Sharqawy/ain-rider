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

import { settingsApi } from '../services/api'
import { useGetSettings, useGetSettingByKey, settingKeys } from '../services/queries'
import { useUpsertSetting, useBatchUpsertSettings } from '../services/mutations'
import { transformSetting } from '../services/transformers'
import { useSettingFilters } from '../hooks/useSettingFilters'

const settingDto = {
  id: 's-1', key: 'app.name', value: 'عين رايدر', type: 'STRING',
  category: 'app-info', isPublic: true, updatedBy: 'admin',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
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

describe('settingsApi', () => {
  it('calls the right endpoints', () => {
    settingsApi.getAll('general')
    expect(api.get).toHaveBeenCalledWith('/admin/settings', { params: { category: 'general' } })
    settingsApi.getAll()
    expect(api.get).toHaveBeenCalledWith('/admin/settings', { params: undefined })
    settingsApi.getByKey('app.name')
    expect(api.get).toHaveBeenCalledWith('/admin/settings/app.name')
    settingsApi.upsert('app.name', { value: 'x', type: 'STRING', category: 'app-info' })
    expect(api.put).toHaveBeenCalledWith('/admin/settings/app.name', {
      value: 'x', type: 'STRING', category: 'app-info',
    })
    settingsApi.batchUpsert([{ key: 'a', value: 1 }])
    expect(api.post).toHaveBeenCalledWith('/admin/settings/batch', { settings: [{ key: 'a', value: 1 }] })
  })
})

describe('transformers', () => {
  it('passes settings through', () => {
    expect(transformSetting(settingDto).key).toBe('app.name')
  })
})

describe('queries', () => {
  it('fetches lists and skips empty keys', async () => {
    api.get.mockResolvedValue({ data: [settingDto] })
    const { wrapper } = makeWrapper()
    const { result: list } = renderHook(() => useGetSettings('app-info'), { wrapper })
    await waitFor(() => expect(list.current.isSuccess).toBe(true))
    expect(list.current.data?.[0].value).toBe('عين رايدر')

    const { result: idle } = renderHook(() => useGetSettingByKey(''), { wrapper })
    expect(idle.current.fetchStatus).toBe('idle')

    const { result: detail } = renderHook(() => useGetSettingByKey('app.name'), { wrapper })
    await waitFor(() => expect(detail.current.isSuccess).toBe(true))
    expect(settingKeys.detail('app.name')).toEqual(['settings', 'detail', 'app.name'])
  })
})

describe('mutations', () => {
  it('upserts a single setting with toasts', async () => {
    api.put.mockResolvedValueOnce({ data: settingDto })
    api.put.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: 'غير صالح' } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useUpsertSetting(), { wrapper })
    act(() => result.current.mutate({ key: 'app.name', data: { value: 'x', type: 'STRING', category: 'app-info' } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث الإعداد بنجاح')

    act(() => result.current.mutate({ key: 'app.name', data: { value: 'y', type: 'STRING', category: 'app-info' } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('غير صالح')
  })

  it('batch upserts with toasts', async () => {
    api.post.mockResolvedValueOnce({ data: { count: 2 } })
    api.post.mockRejectedValueOnce(new Error('x'))
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useBatchUpsertSettings(), { wrapper })
    act(() => result.current.mutate([{ key: 'a', value: 1 }]))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم تحديث الإعدادات بنجاح')

    act(() => result.current.mutate([{ key: 'a', value: 1 }]))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('x')
  })
})

describe('useSettingFilters', () => {
  it('defaults to all and clears', async () => {
    const { result } = renderHook(() => useSettingFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    })
    expect(result.current.filters.category).toBeUndefined()
    await act(async () => {
      await result.current.setCategory('general')
    })
    await waitFor(() => expect(result.current.filters.category).toBe('general'))
    await act(async () => {
      await result.current.clearFilters()
    })
    await waitFor(() => expect(result.current.filters.category).toBeUndefined())
  })
})
