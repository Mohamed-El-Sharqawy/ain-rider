import { vi } from 'vitest'

/**
 * Controllable WebSocket double. Tests drive the socket through `open()`,
 * `message()`, `serverClose()` and assert on `sent`. Install with
 * `vi.stubGlobal('WebSocket', MockWebSocket)` (the provider also reads
 * `WebSocket.OPEN`, so the static constants must match the real enum).
 */
export class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  static instances: MockWebSocket[] = []

  static reset() {
    MockWebSocket.instances = []
  }

  static get last(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1]
  }

  readyState = MockWebSocket.CONNECTING
  sent: string[] = []
  closedWith: number | null = null
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null

  url: string

  constructor(url: string) {
    this.url = url
    MockWebSocket.instances.push(this)
  }

  send = vi.fn((data: string) => {
    this.sent.push(data)
  })

  close = vi.fn((code = 1000) => {
    this.readyState = MockWebSocket.CLOSED
    this.closedWith = code
    this.onclose?.({ code })
  })

  /** Test-side: simulate the server accepting the TCP connection. */
  open() {
    this.readyState = MockWebSocket.OPEN
    this.onopen?.()
  }

  /** Test-side: simulate a JSON message from the server. */
  message(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) })
  }

  /** Test-side: simulate the server dropping the connection. */
  serverClose(code = 1006) {
    this.readyState = MockWebSocket.CLOSED
    this.onclose?.({ code })
  }

  sentJson(index = 0): Record<string, unknown> {
    return JSON.parse(this.sent[index]) as Record<string, unknown>
  }
}

/** Installs the mock WebSocket + a fetch stub and returns both. */
export function installWebSocketMocks(fetchImpl: ReturnType<typeof vi.fn>) {
  MockWebSocket.reset()
  vi.stubGlobal('WebSocket', MockWebSocket)
  vi.stubGlobal('fetch', fetchImpl)
  return { MockWebSocket, fetchMock: fetchImpl }
}
