import { vi } from 'vitest'

/**
 * Shape of the axios instance exported from `@/api/client`, mocked at the
 * network boundary for component/service tests. Keep in sync with the methods
 * the services actually call.
 */
export interface ApiMock {
  get: ReturnType<typeof vi.fn>
  post: ReturnType<typeof vi.fn>
  patch: ReturnType<typeof vi.fn>
  put: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

/** Creates a fresh axios-instance mock. */
export function createApiMock(): ApiMock {
  return {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
}

/**
 * Standard per-file mock of `@/api/client`: everything stays real except the
 * axios instance itself (the system/network boundary).
 *
 * The mock must be created inside `vi.hoisted` (hoisted callbacks run before
 * imports, so inline the object - do not call `createApiMock` there):
 *
 * ```ts
 * const api = vi.hoisted(() => ({
 *   get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn(), delete: vi.fn(),
 * }))
 * vi.mock('@/api/client', async (importOriginal) => ({
 *   ...(await importOriginal<Record<string, unknown>>()),
 *   api,
 * }))
 * ```
 *
 * `mockApiModule(api)` below performs exactly that vi.mock call.
 */
export function mockApiModule(api: ApiMock) {
  vi.mock('@/api/client', async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    api,
  }))
}
