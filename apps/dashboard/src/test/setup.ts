import { expect, afterEach, vi } from 'vitest'
import * as jestDomMatchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'

// The jest-dom "/vitest" entry resolves a second vitest instance when the
// package is externalized; extend the in-graph expect directly instead.
expect.extend(jestDomMatchers)

// Toast calls are asserted via the mocked module; no real toasts render in tests.
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}))

// jsdom's crypto lacks randomUUID (used for realtime notification ids)
if (!globalThis.crypto.randomUUID) {
  let seq = 0
  Object.defineProperty(globalThis.crypto, 'randomUUID', {
    writable: true,
    value: () => `test-uuid-${++seq}`,
  })
}

afterEach(() => {
  cleanup()
})

// jsdom lacks matchMedia (used by useTheme)
if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

// jsdom lacks scrollTo
if (!window.scrollTo) {
  Object.defineProperty(window, 'scrollTo', {
    writable: true,
    value: () => {},
  })
}

// Radix uses ResizeObserver
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (!('ResizeObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'ResizeObserver', {
    writable: true,
    value: MockResizeObserver,
  })
}

// Radix uses IntersectionObserver (hasPointerCapture fallbacks)
class MockIntersectionObserver {
  root = null
  rootMargin = ''
  thresholds = []
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
}
if (!('IntersectionObserver' in globalThis)) {
  Object.defineProperty(globalThis, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  })
}

// Radix presence checks (e.g. tooltips) use element.hasPointerCapture
if (!Element.prototype.hasPointerCapture) {
  Object.defineProperty(Element.prototype, 'hasPointerCapture', {
    writable: true,
    value: () => false,
  })
}
if (!Element.prototype.scrollIntoView) {
  Object.defineProperty(Element.prototype, 'scrollIntoView', {
    writable: true,
    value: () => {},
  })
}
