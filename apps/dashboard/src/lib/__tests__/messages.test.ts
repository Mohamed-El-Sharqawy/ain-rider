import { describe, it, expect } from 'vitest'
import { Messages } from '../messages'

describe('Messages', () => {
  it('exposes the success copy the UI toasts rely on', () => {
    expect(Messages.success.saved).toBe('تم الحفظ بنجاح')
    expect(Messages.success.deleted).toBe('تم الحذف بنجاح')
  })

  it('exposes error copy including the unauthorized message', () => {
    expect(Messages.error.unauthorized).toBe('غير مصرح لك. يرجى تسجيل الدخول مرة أخرى')
  })

  it('exposes loading copy', () => {
    expect(Messages.loading.saving).toBe('جاري الحفظ...')
  })
})
