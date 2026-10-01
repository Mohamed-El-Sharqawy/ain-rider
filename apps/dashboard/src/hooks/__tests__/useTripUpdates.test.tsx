import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'

const wsMock = vi.hoisted(() => ({
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  isConnected: false,
}))

vi.mock('@/providers/WebSocketProvider', () => ({
  useWebSocket: () => wsMock,
}))

import { useTripUpdates } from '../useTripUpdates'

function makeWrapper() {
  const queryClient = new QueryClient()
  queryClient.invalidateQueries = vi.fn()
  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  }
}

const handlers = new Map<string, (data: unknown) => void>()

describe('useTripUpdates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    handlers.clear()
    wsMock.on.mockImplementation((type: string, cb: (data: unknown) => void) => {
      handlers.set(type, cb)
      return () => handlers.delete(type)
    })
    wsMock.isConnected = false
  })

  it('does nothing without a trip id', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useTripUpdates(undefined), { wrapper })
    expect(wsMock.subscribe).not.toHaveBeenCalled()
    expect(wsMock.on).not.toHaveBeenCalled()
  })

  it('does nothing while the socket is disconnected', () => {
    const { wrapper } = makeWrapper()
    renderHook(() => useTripUpdates('t-1'), { wrapper })
    expect(wsMock.subscribe).not.toHaveBeenCalled()
  })

  it('subscribes and invalidates queries on trip events while connected', () => {
    wsMock.isConnected = true
    const { queryClient, wrapper } = makeWrapper()
    renderHook(() => useTripUpdates('t-1'), { wrapper })

    expect(wsMock.subscribe).toHaveBeenCalledWith('trip', 't-1')
    expect(handlers.has('trip_matched')).toBe(true)
    expect(handlers.has('trip_started')).toBe(true)
    expect(handlers.has('trip_completed')).toBe(true)

    handlers.get('trip_matched')!(undefined)
    handlers.get('trip_started')!(undefined)
    expect(queryClient.invalidateQueries).toHaveBeenCalledTimes(4)

    handlers.get('trip_completed')!(undefined)
    const keys = (queryClient.invalidateQueries as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0].queryKey,
    )
    // completed invalidates detail, all and stats
    expect(keys.some((k) => JSON.stringify(k).includes('"stats"'))).toBe(true)
  })

  it('unsubscribes from everything on unmount', () => {
    wsMock.isConnected = true
    const { wrapper } = makeWrapper()
    const { unmount } = renderHook(() => useTripUpdates('t-1'), { wrapper })

    unmount()
    expect(wsMock.unsubscribe).toHaveBeenCalledWith('trip', 't-1')
    expect(handlers.size).toBe(0)
  })

  it('resubscribes when the connection drops and recovers', () => {
    wsMock.isConnected = true
    const { wrapper } = makeWrapper()
    const { rerender } = renderHook(() => useTripUpdates('t-1'), { wrapper })

    wsMock.isConnected = false
    rerender()
    expect(wsMock.unsubscribe).toHaveBeenCalledWith('trip', 't-1')

    wsMock.isConnected = true
    rerender()
    expect(wsMock.subscribe).toHaveBeenCalledTimes(2)
  })
})
