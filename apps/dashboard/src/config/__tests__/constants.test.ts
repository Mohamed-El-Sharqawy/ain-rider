import { describe, it, expect, afterEach, vi } from 'vitest'
import { ApiConfig } from '../constants'

describe('ApiConfig (test env)', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('falls back to local gateway and ws URLs when no env is set', () => {
    expect(ApiConfig.gatewayUrl).toBe('http://localhost:3000')
    expect(ApiConfig.wsUrl).toBe('ws://localhost:3001/ws')
  })

  it('does not log the fatal warning outside production', () => {
    const error = vi.spyOn(console, 'error')
    vi.resetModules()
    void import('../constants')
    expect(error).not.toHaveBeenCalled()
  })

  it('logs a fatal error in production when VITE_WS_URL is missing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.resetModules()
    vi.stubEnv('PROD', true)
    const mod = await import('../constants')
    expect(error).toHaveBeenCalledOnce()
    expect(error.mock.calls[0][0]).toContain('VITE_WS_URL')
    expect(mod.ApiConfig.wsUrl).toBe('ws://localhost:3001/ws')
  })

  it('uses VITE_WS_URL from the environment when provided', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_WS_URL', 'wss://ws.ainrider.com/ws')
    vi.stubEnv('VITE_API_GATEWAY_URL', 'https://api.ainrider.com')
    const mod = await import('../constants')
    expect(mod.ApiConfig.wsUrl).toBe('wss://ws.ainrider.com/ws')
    expect(mod.ApiConfig.gatewayUrl).toBe('https://api.ainrider.com')
  })
})
