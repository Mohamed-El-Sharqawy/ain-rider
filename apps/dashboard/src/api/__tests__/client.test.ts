import { describe, it, expect, beforeEach, vi } from 'vitest'
import axios, { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import { api, getApiError, toApiError } from '../client'

function axiosError(
  status: number,
  config: InternalAxiosRequestConfig,
  data: unknown = {},
): AxiosError {
  const response = {
    status,
    data,
    statusText: '',
    headers: {},
    config,
  } as AxiosResponse
  return new AxiosError(
    `Request failed with status code ${status}`,
    status === 401 ? AxiosError.ERR_BAD_REQUEST : AxiosError.ERR_BAD_RESPONSE,
    config,
    {},
    response,
  )
}

function okResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    status: 200,
    statusText: 'OK',
    data,
    headers: {},
    config,
  }
}

describe('getApiError', () => {
  it('joins array messages from error.message', () => {
    const err = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { error: { message: ['حقل مطلوب', 'غير صالح'] } })
    expect(getApiError(err)).toBe('حقل مطلوب, غير صالح')
  })

  it('returns string error.message', () => {
    const err = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { error: { message: 'مرفوض' } })
    expect(getApiError(err)).toBe('مرفوض')
  })

  it('falls back to top-level message', () => {
    const err = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { message: 'عام' })
    expect(getApiError(err)).toBe('عام')
  })

  it('joins array top-level messages', () => {
    const err = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { message: ['أ', 'ب'] })
    expect(getApiError(err)).toBe('أ, ب')
  })

  it('falls back to the axios error message', () => {
    const err = axiosError(500, { url: '/x' } as InternalAxiosRequestConfig, {})
    expect(getApiError(err)).toBe('Request failed with status code 500')
  })

  it('unwraps plain Errors', () => {
    expect(getApiError(new Error('boom'))).toBe('boom')
  })

  it('returns a generic message for unknown shapes', () => {
    expect(getApiError('nope')).toBe('An unexpected error occurred')
  })
})

describe('toApiError', () => {
  it('returns null for non-axios errors', () => {
    expect(toApiError(new Error('x'))).toBeNull()
  })

  it('maps an axios error to a structured ApiError', () => {
    const err = axiosError(403, { url: '/x' } as InternalAxiosRequestConfig, { error: { message: ['ممنوع'], code: 'FORBIDDEN' } })
    expect(toApiError(err)).toEqual({
      status: 403,
      code: 'FORBIDDEN',
      message: 'ممنوع',
      raw: { error: { message: ['ممنوع'], code: 'FORBIDDEN' } },
    })
  })

  it('uses top-level message and zero status when there is no response', () => {
    const err = new AxiosError('Network Error')
    expect(toApiError(err)).toEqual({
      status: 0,
      code: undefined,
      message: 'Network Error',
      raw: {},
    })
  })

  it('uses the string error.message as-is', () => {
    const err = axiosError(422, { url: '/x' } as InternalAxiosRequestConfig, { error: { message: 'غير صالح' } })
    expect(toApiError(err)?.message).toBe('غير صالح')
  })

  it('joins and passes through array/string top-level messages', () => {
    const joined = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { message: ['أ', 'ب'] })
    expect(toApiError(joined)?.message).toBe('أ, ب')

    const plain = axiosError(400, { url: '/x' } as InternalAxiosRequestConfig, { message: 'عام' })
    expect(toApiError(plain)?.message).toBe('عام')
  })
})

describe('response interceptor', () => {
  let unauthorizedListener: ReturnType<typeof vi.fn>

  beforeEach(() => {
    unauthorizedListener = vi.fn()
    window.addEventListener('auth:unauthorized', unauthorizedListener)
    return () => window.removeEventListener('auth:unauthorized', unauthorizedListener)
  })

  it('rejects non-axios errors untouched', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async () => {
      throw new Error('network down')
    }) as AxiosAdapter
    await expect(api.get('/data')).rejects.toThrow('network down')
    api.defaults.adapter = original
  })

  it('passes through non-401 errors', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async (config) => {
      throw axiosError(500, config)
    }) as AxiosAdapter
    await expect(api.get('/data')).rejects.toMatchObject({ response: { status: 500 } })
    expect(unauthorizedListener).not.toHaveBeenCalled()
    api.defaults.adapter = original
  })

  it('dispatches auth:unauthorized when the refresh endpoint itself 401s', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async (config) => {
      throw axiosError(401, config)
    }) as AxiosAdapter
    await expect(api.post('/auth/refresh')).rejects.toBeInstanceOf(AxiosError)
    expect(unauthorizedListener).toHaveBeenCalledOnce()
    api.defaults.adapter = original
  })

  it('refreshes the session and retries the original 401 request', async () => {
    const original = api.defaults.adapter
    let dataCalls = 0
    api.defaults.adapter = (async (config) => {
      if (config.url === '/data') {
        dataCalls += 1
        if (dataCalls === 1) throw axiosError(401, config)
        return okResponse(config, { ok: true })
      }
      if (config.url === '/auth/refresh') {
        return okResponse(config, { success: true })
      }
      throw new Error(`unexpected url ${config.url}`)
    }) as AxiosAdapter

    const res = await api.get('/data')
    expect(res.data).toEqual({ ok: true })
    expect(dataCalls).toBe(2)
    expect(unauthorizedListener).not.toHaveBeenCalled()
    api.defaults.adapter = original
  })

  it('dispatches auth:unauthorized when the refresh fails', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async (config) => {
      if (config.url === '/data') throw axiosError(401, config)
      if (config.url === '/auth/refresh') throw axiosError(401, config)
      throw new Error(`unexpected url ${config.url}`)
    }) as AxiosAdapter

    await expect(api.get('/data')).rejects.toBeInstanceOf(AxiosError)
    expect(unauthorizedListener).toHaveBeenCalledOnce()
    api.defaults.adapter = original
  })

  it('queues concurrent 401s and retries them after a single refresh', async () => {
    const original = api.defaults.adapter
    let refreshCalls = 0
    const attempts = new Map<string, number>()
    api.defaults.adapter = (async (config) => {
      if (config.url === '/auth/refresh') {
        refreshCalls += 1
        return okResponse(config, { success: true })
      }
      const seen = (attempts.get(config.url!) ?? 0) + 1
      attempts.set(config.url!, seen)
      if (seen === 1) throw axiosError(401, config)
      return okResponse(config, { url: config.url })
    }) as AxiosAdapter

    const [a, b] = await Promise.all([api.get('/a'), api.get('/b')])
    expect(a.data).toEqual({ url: '/a' })
    expect(b.data).toEqual({ url: '/b' })
    expect(refreshCalls).toBe(1)
    expect(attempts.get('/a')).toBe(2)
    expect(attempts.get('/b')).toBe(2)
    api.defaults.adapter = original
  })

  it('rejects queued requests when the refresh fails', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async (config) => {
      if (config.url === '/auth/refresh') throw axiosError(401, config)
      throw axiosError(401, config)
    }) as AxiosAdapter

    // first request triggers the refresh; the second is queued behind it
    const first = api.get('/a')
    const second = api.get('/b')
    await expect(first).rejects.toBeInstanceOf(AxiosError)
    // the queued request is rejected through the queue's .then/.catch chain
    await expect(second).rejects.toBeInstanceOf(AxiosError)
    api.defaults.adapter = original
  })

  it('rejects a retried request that 401s again', async () => {
    const original = api.defaults.adapter
    api.defaults.adapter = (async (config) => {
      if (config.url === '/auth/refresh') return okResponse(config, {})
      throw axiosError(401, config)
    }) as AxiosAdapter

    await expect(api.get('/data')).rejects.toMatchObject({ response: { status: 401 } })
    api.defaults.adapter = original
  })

  it('is configured for cookie auth', () => {
    expect(api.defaults.withCredentials).toBe(true)
    expect(api.defaults.timeout).toBe(15_000)
    expect(axios.isAxiosError(new AxiosError('x'))).toBe(true)
  })
})
