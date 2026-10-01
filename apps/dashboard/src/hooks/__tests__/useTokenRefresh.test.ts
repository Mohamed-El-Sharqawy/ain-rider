import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'

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

import { useTokenRefresh } from '../useTokenRefresh'

const REFRESH_INTERVAL = 14 * 60 * 1000

describe('useTokenRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('refreshes the session on the interval', async () => {
    api.post.mockResolvedValue({ data: { success: true } })
    renderHook(() => useTokenRefresh())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL)
    })
    expect(api.post).toHaveBeenCalledWith('/auth/refresh')

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL)
    })
    expect(api.post).toHaveBeenCalledTimes(2)
  })

  it('dispatches auth:unauthorized when the refresh fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const listener = vi.fn()
    window.addEventListener('auth:unauthorized', listener)
    api.post.mockRejectedValue(new Error('expired'))

    renderHook(() => useTokenRefresh())
    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL)
    })

    expect(listener).toHaveBeenCalledOnce()
    expect(errorSpy).toHaveBeenCalledWith('Token refresh failed:', expect.any(Error))
    window.removeEventListener('auth:unauthorized', listener)
  })

  it('stops refreshing after unmount', async () => {
    api.post.mockResolvedValue({ data: { success: true } })
    const { unmount } = renderHook(() => useTokenRefresh())
    unmount()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL * 3)
    })
    expect(api.post).not.toHaveBeenCalled()
  })
})
