import { describe, it, expect, beforeEach } from 'vitest'
import { useAuthStore } from '../authStore'
import type { AdminUser } from '@/pages/login/services/transformers'

const admin: AdminUser = {
  id: 'u1',
  email: 'admin@ainrider.com',
  firstName: 'Mohamed',
  lastName: 'Ahmed',
  fullName: 'Mohamed Ahmed',
  phoneNumber: '+201001234567',
  role: 'ADMIN',
  status: 'ACTIVE',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({ user: null, isAuthenticated: false })
  })

  it('starts unauthenticated', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('setUser stores the user and authenticates', () => {
    useAuthStore.getState().setUser(admin)
    const state = useAuthStore.getState()
    expect(state.user).toEqual(admin)
    expect(state.isAuthenticated).toBe(true)
  })

  it('clear resets to the logged-out state', () => {
    useAuthStore.getState().setUser(admin)
    useAuthStore.getState().clear()
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.isAuthenticated).toBe(false)
  })

  it('persists only user and isAuthenticated to localStorage', async () => {
    useAuthStore.getState().setUser(admin)
    await Promise.resolve()
    const raw = localStorage.getItem('auth-storage')
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw!) as { state: Record<string, unknown> }
    expect(persisted.state.user).toEqual(admin)
    expect(persisted.state.isAuthenticated).toBe(true)
    expect('setUser' in persisted.state).toBe(false)
    expect('clear' in persisted.state).toBe(false)
  })

  it('rehydrates a persisted session from localStorage', async () => {
    localStorage.setItem(
      'auth-storage',
      JSON.stringify({ state: { user: admin, isAuthenticated: true }, version: 0 }),
    )
    await useAuthStore.persist.rehydrate()
    const state = useAuthStore.getState()
    expect(state.user).toEqual(admin)
    expect(state.isAuthenticated).toBe(true)
  })
})
