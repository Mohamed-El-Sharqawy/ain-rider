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

import { walletsApi } from '../services/api'
import { useGetWalletByUser, useGetWithdrawals, walletKeys } from '../services/queries'
import {
  useCreditWallet,
  useDebitWallet,
  useProcessWithdrawal,
} from '../services/mutations'
import { transformWallet, transformWithdrawal } from '../services/transformers'
import { useWalletFilters } from '../hooks/useWalletFilters'

const walletDto = {
  id: 'w-1', userId: 'u-1', balance: 500, currency: 'EGP',
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
}

const withdrawalDto = {
  id: 'wd-1', userId: 'u-1', amount: 300, status: 'PENDING',
  bankDetails: { accountName: 'أحمد', accountNumber: '123456', bankName: 'بنك مصر' },
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

describe('walletsApi', () => {
  it('calls the right endpoints', () => {
    walletsApi.getByUser('u-1')
    expect(api.get).toHaveBeenCalledWith('/admin/wallets/user/u-1')
    walletsApi.credit({ userId: 'u-1', amount: 50 })
    expect(api.post).toHaveBeenCalledWith('/admin/wallets/credit', { userId: 'u-1', amount: 50 })
    walletsApi.debit({ userId: 'u-1', amount: 50 })
    expect(api.post).toHaveBeenCalledWith('/admin/wallets/debit', { userId: 'u-1', amount: 50 })
    walletsApi.getWithdrawals('PENDING')
    expect(api.get).toHaveBeenCalledWith('/admin/withdrawals', { params: { status: 'PENDING' } })
    walletsApi.processWithdrawal('wd-1', { approve: true })
    expect(api.patch).toHaveBeenCalledWith('/admin/withdrawals/wd-1/process', { approve: true })
  })
})

describe('transformers', () => {
  it('flattens the withdrawal bank details', () => {
    const w = transformWithdrawal(withdrawalDto)
    expect(w.accountName).toBe('أحمد')
    expect(w.bankName).toBe('بنك مصر')
    expect(transformWallet(walletDto).balance).toBe(500)
  })
})

describe('queries', () => {
  it('skips the wallet query without a user id', () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useGetWalletByUser(''), { wrapper })
    expect(result.current.fetchStatus).toBe('idle')
  })

  it('fetches wallet + withdrawals', async () => {
    api.get.mockImplementation((url: string) => {
      if (url === '/admin/wallets/user/u-1') return Promise.resolve({ data: walletDto })
      if (url === '/admin/withdrawals') return Promise.resolve({ data: [withdrawalDto] })
      return Promise.reject(new Error(url))
    })
    const { wrapper } = makeWrapper()
    const { result: wallet } = renderHook(() => useGetWalletByUser('u-1'), { wrapper })
    const { result: withdrawals } = renderHook(() => useGetWithdrawals(), { wrapper })
    await waitFor(() => expect(wallet.current.isSuccess).toBe(true))
    await waitFor(() => expect(withdrawals.current.isSuccess).toBe(true))
    expect(withdrawals.current.data?.[0].accountNumber).toBe('123456')
    expect(walletKeys.withdrawals('PENDING')).toEqual(['wallets', 'withdrawals', { status: 'PENDING' }])
  })
})

describe('mutations', () => {
  it('credits and debits with toasts', async () => {
    api.post.mockResolvedValue({ data: walletDto })
    const { wrapper } = makeWrapper()
    const { result: credit } = renderHook(() => useCreditWallet(), { wrapper })
    const { result: debit } = renderHook(() => useDebitWallet(), { wrapper })
    act(() => credit.current.mutate({ userId: 'u-1', amount: 50 }))
    await waitFor(() => expect(credit.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تمت إضافة الرصيد بنجاح')
    act(() => debit.current.mutate({ userId: 'u-1', amount: 20 }))
    await waitFor(() => expect(debit.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تم خصم الرصيد بنجاح')
  })

  it('processes a withdrawal and toasts api errors', async () => {
    api.patch.mockResolvedValueOnce({ data: withdrawalDto })
    api.patch.mockRejectedValueOnce({
      isAxiosError: true,
      response: { status: 400, data: { error: { message: ['مغلق حالياً'] } } },
    })
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useProcessWithdrawal(), { wrapper })
    act(() => result.current.mutate({ id: 'wd-1', data: { approve: true } }))
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(toast.success).toHaveBeenCalledWith('تمت معالجة طلب السحب بنجاح')

    act(() => result.current.mutate({ id: 'wd-1', data: { approve: true } }))
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('مغلق حالياً')
  })

  it('toasts the api error when crediting or debiting fails', async () => {
    api.post.mockRejectedValue({
      isAxiosError: true,
      response: { status: 404, data: { error: { message: 'المحفظة غير موجودة' } } },
    })
    const { wrapper } = makeWrapper()
    const { result: credit } = renderHook(() => useCreditWallet(), { wrapper })
    const { result: debit } = renderHook(() => useDebitWallet(), { wrapper })

    act(() => credit.current.mutate({ userId: 'u-1', amount: 100 } as never))
    await waitFor(() => expect(credit.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('المحفظة غير موجودة')

    act(() => debit.current.mutate({ userId: 'u-1', amount: 100 } as never))
    await waitFor(() => expect(debit.current.isError).toBe(true))
    expect(toast.error).toHaveBeenCalledWith('المحفظة غير موجودة')
  })
})

describe('useWalletFilters', () => {
  it('defaults to all, maps to undefined and clears', async () => {
    const { result } = renderHook(() => useWalletFilters(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
      ),
    })
    expect(result.current.filters.status).toBeUndefined()
    await act(async () => {
      await result.current.setStatus('PENDING')
    })
    await waitFor(() => expect(result.current.filters.status).toBe('PENDING'))
    await act(async () => {
      await result.current.clearFilters()
    })
    await waitFor(() => expect(result.current.filters.status).toBeUndefined())
  })
})
