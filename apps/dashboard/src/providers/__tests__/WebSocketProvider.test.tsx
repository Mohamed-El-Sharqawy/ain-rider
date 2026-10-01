import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, renderHook, act } from '@testing-library/react'
import { useAuthStore } from '@/stores/authStore'
import { WebSocketProvider, useWebSocket } from '@/providers/WebSocketProvider'
import { MockWebSocket, installWebSocketMocks } from '@/test/ws-mock'

const admin = {
  id: 'admin-1',
  email: 'admin@ainrider.com',
  firstName: 'عامر',
  lastName: 'الأدمن',
  fullName: 'عامر الأدمن',
  phoneNumber: '+201001234567',
  role: 'ADMIN' as const,
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function tokenResponse(token: string | null, ok = true) {
  return { ok, json: async () => ({ token }) }
}

function renderProvider() {
  function Probe() {
    const ws = useWebSocket()
    return (
      <div>
        <span data-testid="connected">{String(ws.isConnected)}</span>
        <span data-testid="authed">{String(ws.isAuthed)}</span>
      </div>
    )
  }
  return render(
    <WebSocketProvider>
      <Probe />
    </WebSocketProvider>,
  )
}

function goOnline() {
  act(() => {
    useAuthStore.setState({ user: admin, isAuthenticated: true })
  })
}

describe('useWebSocket outside provider', () => {
  it('throws without a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => renderHook(() => useWebSocket())).toThrow(
      'useWebSocket must be used within a WebSocketProvider',
    )
  })
})

describe('WebSocketProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('does not open a socket while unauthenticated', () => {
    installWebSocketMocks(vi.fn())
    renderProvider()
    expect(MockWebSocket.instances).toHaveLength(0)
  })

  it('connects, authenticates with the fetched token and reports state', async () => {
    const { fetchMock } = installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok-123')))
    renderProvider()

    goOnline()
    expect(MockWebSocket.instances).toHaveLength(1)
    const ws = MockWebSocket.last
    expect(screen.getByTestId('connected')).toHaveTextContent('false')

    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/auth/ws-token'),
      expect.objectContaining({ credentials: 'include' }),
    )
    expect(ws.sentJson()).toEqual({ type: 'auth', token: 'tok-123' })

    act(() => ws.message({ type: 'auth_success' }))
    expect(screen.getByTestId('connected')).toHaveTextContent('true')
    expect(screen.getByTestId('authed')).toHaveTextContent('true')
    // admin user id is auto-subscribed to the user channel
    expect(ws.sentJson(1)).toEqual({ type: 'subscribe', channel: 'user', id: 'admin-1' })
  })

  it('skips the user subscription when there is no user id', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    useAuthStore.setState({ user: null, isAuthenticated: true })
    renderProvider()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    ws.sent.length = 0
    act(() => ws.message({ type: 'auth_success' }))
    expect(ws.sent).toHaveLength(0)
  })

  it('closes the socket when the ws-token request fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse(null, false)))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    expect(errorSpy).toHaveBeenCalledWith('[WebSocket] Failed to get WS token')
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('closes the socket when the token endpoint throws', async () => {
    installWebSocketMocks(vi.fn().mockRejectedValue(new Error('offline')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('answers ping with pong and ignores pong + malformed messages', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0

    act(() => ws.message({ type: 'ping' }))
    expect(ws.sentJson()).toEqual({ type: 'pong', timestamp: expect.any(Number) })

    ws.sent.length = 0
    act(() => ws.message({ type: 'pong' }))
    expect(ws.sent).toHaveLength(0)

    expect(() => {
      act(() => ws.onmessage?.({ data: 'not-json{__(' }))
    }).not.toThrow()
  })

  it('closes the socket on auth_error', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_error' }))
    expect(screen.getByTestId('authed')).toHaveTextContent('false')
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('delivers messages to on() handlers and supports unsubscribe', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    const handler = vi.fn()
    let capturedOn: ((type: string, cb: (data: unknown) => void) => () => void) | null = null

    function Probe() {
      const ws = useWebSocket()
      capturedOn = ws.on
      return null
    }
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    let unsubscribe: () => void = () => {}
    act(() => {
      unsubscribe = capturedOn!('trip_status', handler)
    })
    act(() => ws.message({ type: 'trip_status', data: { id: 't1' } }))
    expect(handler).toHaveBeenCalledWith({ id: 't1' })

    act(() => {
      unsubscribe()
    })
    act(() => ws.message({ type: 'trip_status', data: { id: 't2' } }))
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('sends subscribe while connected and buffers when disconnected', async () => {
    let captured: {
      subscribe: (channel: string, id: string) => void
      unsubscribe: (channel: string, id: string) => void
    } | null = null
    function Probe() {
      const ws = useWebSocket()
      captured = ws
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()

    // not connected yet: buffered for resend after auth_success
    act(() => {
      captured!.subscribe('trip', 't-9')
    })
    const ws = MockWebSocket.last
    expect(ws.sent).toHaveLength(0)

    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    ws.sent.length = 0
    act(() => ws.message({ type: 'auth_success' }))
    // buffered subscription replayed after the auto user-channel subscription
    expect(JSON.parse(ws.sent[1])).toEqual({ type: 'subscribe', channel: 'trip', id: 't-9' })

    ws.sent.length = 0
    act(() => {
      captured!.unsubscribe('trip', 't-9')
    })
    expect(ws.sentJson()).toEqual({ type: 'unsubscribe', channel: 'trip', id: 't-9' })
  })

  it('reconnects with backoff after an abnormal server close', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    expect(MockWebSocket.instances).toHaveLength(1)
    MockWebSocket.last.serverClose(1006)
    expect(screen.getByTestId('connected')).toHaveTextContent('false')

    // first reconnect delay: 2s * 2^0 + jitter(<=1s)
    await vi.advanceTimersByTimeAsync(3100)
    expect(MockWebSocket.instances).toHaveLength(2)

    const second = MockWebSocket.last
    second.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => second.message({ type: 'auth_success' }))
    expect(screen.getByTestId('connected')).toHaveTextContent('true')

    // drop again; second attempt delay is 2s * 2^1 + jitter, capped at 30s
    second.serverClose(1006)
    await vi.advanceTimersByTimeAsync(3400)
    expect(MockWebSocket.instances).toHaveLength(3)
  })

  it('does not reconnect once unmounted', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    const { unmount } = renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    unmount()
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
    await vi.advanceTimersByTimeAsync(60000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('clears the session when the server closes with 4001', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()
    expect(useAuthStore.getState().isAuthenticated).toBe(true)

    MockWebSocket.last.serverClose(4001)
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    // no reconnect scheduled for kicked sessions
    await vi.advanceTimersByTimeAsync(60000)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('resets the reconnect backoff when the user re-authenticates', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()

    goOnline()
    MockWebSocket.last.serverClose(1006)
    await vi.advanceTimersByTimeAsync(3100)
    expect(MockWebSocket.instances).toHaveLength(2)

    // simulate a fresh login: attempt counter resets, first delay is short again
    act(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false })
    })
    act(() => {
      useAuthStore.setState({ user: admin, isAuthenticated: true })
    })
    expect(MockWebSocket.instances).toHaveLength(3)
  })

  it('pings the server on the interval after auth_success', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0

    await vi.advanceTimersByTimeAsync(30000)
    expect(ws.sentJson()).toEqual({ type: 'ping' })
    await vi.advanceTimersByTimeAsync(30000)
    expect(ws.sent[1] && JSON.parse(ws.sent[1])).toEqual({ type: 'ping' })
  })

  it('skips a ping tick that lands inside the closing handshake', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0

    // close handshake started but onclose has not fired yet
    ws.readyState = MockWebSocket.CLOSING
    expect(() => vi.advanceTimersByTime(30000)).not.toThrow()
    expect(ws.sent).toHaveLength(0)
  })

  it('leaves recovery from a transport error to the close event', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    // error alone changes nothing; the following close drives the reconnect
    expect(() => act(() => ws.onerror?.(new Event('error')))).not.toThrow()
    expect(screen.getByTestId('connected')).toHaveTextContent('true')
    expect(MockWebSocket.instances).toHaveLength(1)

    ws.serverClose(1006)
    await vi.advanceTimersByTimeAsync(3100)
    expect(MockWebSocket.instances).toHaveLength(2)
  })

  it('closes a socket whose server vanished before the token arrived', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(new Promise(() => {})))
    const { unmount } = renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    unmount()
    // the late onopen must not send auth on a closed socket
    await vi.advanceTimersByTimeAsync(60000)
    expect(ws.sent).toHaveLength(0)
  })

  it('closes the socket when onopen fires after unmount', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    const { unmount } = renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    unmount()
    ws.open()
    await vi.advanceTimersByTimeAsync(60000)
    expect(ws.sent).toHaveLength(0)
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('sends a subscribe immediately while connected and authenticated', async () => {
    let captured: { subscribe: (channel: string, id: string) => void } | null = null
    function Probe() {
      captured = useWebSocket()
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0

    act(() => {
      captured!.subscribe('trip', 't-live')
    })
    expect(ws.sentJson()).toEqual({ type: 'subscribe', channel: 'trip', id: 't-live' })
  })

  it('skips a connect attempt while the handshake is still in flight', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(new Promise(() => {})))
    renderProvider()
    goOnline()
    expect(MockWebSocket.instances).toHaveLength(1)

    // in a real browser close() fires onclose on a later task; simulate that
    // window so the in-flight handshake is still marked connecting
    const ws = MockWebSocket.last
    ws.close = () => {}
    act(() => {
      useAuthStore.setState({ user: null, isAuthenticated: false })
    })
    act(() => {
      useAuthStore.setState({ user: admin, isAuthenticated: true })
    })
    // the in-flight attempt wins: no second socket was created
    expect(MockWebSocket.instances).toHaveLength(1)
  })

  it('closes the socket when the token lands after unmount', async () => {
    let resolveToken!: (value: { ok: boolean; json: () => Promise<{ token: string }> }) => void
    installWebSocketMocks(
      vi.fn().mockImplementation(() => new Promise((resolve) => { resolveToken = resolve })),
    )
    const { unmount } = renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    unmount()
    resolveToken!(tokenResponse('late-token'))
    await vi.advanceTimersByTimeAsync(0)
    expect(ws.closedWith).not.toBeNull()
    expect(ws.sent).toHaveLength(0)
  })

  it('treats a token response without a token field as a failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    installWebSocketMocks(vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    expect(errorSpy).toHaveBeenCalledWith('[WebSocket] Failed to get WS token')
    expect(ws.readyState).toBe(MockWebSocket.CLOSED)
  })

  it('ignores a ping that arrives after the socket dropped', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0
    ws.serverClose(1006)

    expect(() => act(() => ws.message({ type: 'ping' }))).not.toThrow()
    expect(ws.sent).toHaveLength(0)
  })

  it('replaces the ping interval when auth_success repeats', async () => {
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))
    act(() => ws.message({ type: 'auth_success' }))
    ws.sent.length = 0

    // exactly one interval remains: only one ping per 30s window
    await vi.advanceTimersByTimeAsync(30000)
    const pings = ws.sent.filter((s) => JSON.parse(s).type === 'ping')
    expect(pings).toHaveLength(1)
  })

  it('buffers subscribe and unsubscribe while open but not yet authenticated', async () => {
    let captured: {
      subscribe: (channel: string, id: string) => void
      unsubscribe: (channel: string, id: string) => void
    } | null = null
    function Probe() {
      captured = useWebSocket()
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    ws.sent.length = 0
    // handshake not completed yet: still buffered, nothing sent
    act(() => {
      captured!.subscribe('trip', 't-1')
    })
    act(() => {
      captured!.unsubscribe('trip', 't-1')
    })
    expect(ws.sent).toHaveLength(0)

    act(() => ws.message({ type: 'auth_success' }))
    // only the user-channel auto-subscription went out
    expect(ws.sent).toHaveLength(1)
  })

  it('supports multiple handlers on the same event type', async () => {
    const first = vi.fn()
    const second = vi.fn()
    let capturedOn: ((type: string, cb: (data: unknown) => void) => () => void) | null = null
    function Probe() {
      capturedOn = useWebSocket().on
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()
    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    let removeFirst: () => void = () => {}
    act(() => {
      removeFirst = capturedOn!('trip_status', first)
      capturedOn!('trip_status', second)
    })
    act(() => ws.message({ type: 'trip_status', data: { id: 't-1' } }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)

    // removing one handler keeps the other listening
    act(() => {
      removeFirst()
    })
    act(() => ws.message({ type: 'trip_status', data: { id: 't-2' } }))
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
  })

  it('survives a double unsubscribe', async () => {
    let capturedOn: ((type: string, cb: (data: unknown) => void) => () => void) | null = null
    function Probe() {
      capturedOn = useWebSocket().on
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()
    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    let unsubscribe: () => void = () => {}
    act(() => {
      unsubscribe = capturedOn!('solo', vi.fn())
    })
    act(() => {
      unsubscribe()
      unsubscribe()
    })
    expect(() => act(() => ws.message({ type: 'solo', data: 1 }))).not.toThrow()
  })

  it('skips buffered subscriptions with empty ids after auth_success', async () => {
    let captured: { subscribe: (channel: string, id: string) => void } | null = null
    function Probe() {
      captured = useWebSocket()
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()

    act(() => {
      captured!.subscribe('trip', '')
    })
    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    ws.sent.length = 0
    act(() => ws.message({ type: 'auth_success' }))
    // only the user channel was sent; the malformed key was skipped
    expect(ws.sent).toHaveLength(1)
    expect(ws.sentJson()).toEqual({ type: 'subscribe', channel: 'user', id: 'admin-1' })
  })

  it('recovers when the server sends a message after an unsubscribe cleared the map', async () => {
    let capturedOn: ((type: string, cb: (data: unknown) => void) => () => void) | null = null
    function Probe() {
      capturedOn = useWebSocket().on
      return null
    }
    installWebSocketMocks(vi.fn().mockResolvedValue(tokenResponse('tok')))
    render(
      <WebSocketProvider>
        <Probe />
      </WebSocketProvider>,
    )
    goOnline()
    const ws = MockWebSocket.last
    ws.open()
    await vi.advanceTimersByTimeAsync(0)
    act(() => ws.message({ type: 'auth_success' }))

    let unsubscribe: () => void = () => {}
    act(() => {
      unsubscribe = capturedOn!('solo', vi.fn())
    })
    act(() => {
      unsubscribe()
    })
    // handler map entry removed; dispatching again must not throw
    expect(() => act(() => ws.message({ type: 'solo', data: 1 }))).not.toThrow()
  })

  it('does not send the auth payload if the socket dropped during the token fetch', async () => {
    let resolveToken!: (value: { ok: boolean; json: () => Promise<{ token: string }> }) => void
    installWebSocketMocks(
      vi.fn().mockImplementation(() => new Promise((resolve) => { resolveToken = resolve })),
    )
    renderProvider()
    goOnline()

    const ws = MockWebSocket.last
    ws.open()
    act(() => {
      ws.serverClose(1006)
    })
    resolveToken!(tokenResponse('late-token'))
    await vi.advanceTimersByTimeAsync(0)
    expect(ws.sent).toHaveLength(0)
  })
})
