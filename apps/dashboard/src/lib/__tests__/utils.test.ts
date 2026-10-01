import { describe, it, expect, vi } from 'vitest'
import {
  cn,
  formatDate,
  formatCurrency,
  getInitials,
  formatRelativeTime,
} from '../utils'

describe('cn', () => {
  it('merges conflicting tailwind classes keeping the last one', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('joins non-conflicting classes', () => {
    expect(cn('flex', 'p-2')).toBe('flex p-2')
  })

  it('ignores falsy inputs', () => {
    const falsy = false as boolean | string | undefined | null
    expect(cn('p-2', falsy && 'm-2', undefined, null)).toBe('p-2')
  })
})

describe('formatDate', () => {
  it('formats a date in ar-EG with the year and month', () => {
    // mid-year, mid-day: year/month are stable in any local timezone
    const out = formatDate('2026-06-15T12:00:00Z')
    expect(out).toContain('٢٠٢٦')
    expect(out).toContain('يونيو')
  })

  it('accepts a Date object too', () => {
    const out = formatDate(new Date('2026-06-15T12:00:00Z'))
    expect(out).toContain('٢٠٢٦')
  })
})

describe('formatCurrency', () => {
  it('formats an amount in EGP by default using arabic digits', () => {
    expect(formatCurrency(1234)).toContain('١٬٢٣٤')
  })

  it('honours an explicit currency', () => {
    const out = formatCurrency(50, 'USD')
    expect(out).toContain('٥٠')
    expect(out).not.toBe(formatCurrency(50, 'EGP'))
  })

  it('drops fraction digits', () => {
    expect(formatCurrency(100.75)).not.toContain('٧٥')
  })
})

describe('getInitials', () => {
  it('takes the first letter of the first two words', () => {
    expect(getInitials('mohamed ahmed')).toBe('MA')
  })

  it('uses at most two letters', () => {
    expect(getInitials('mohamed ahmed ali')).toBe('MA')
  })

  it('uppercases a single word initial', () => {
    expect(getInitials('sara')).toBe('S')
  })
})

describe('formatRelativeTime', () => {
  it.beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-15T12:00:00Z'))
  })
  it.afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "now" for moments under a minute ago', () => {
    expect(formatRelativeTime('2026-06-15T11:59:30Z')).toBe('الآن')
  })

  it('returns minutes for under an hour', () => {
    expect(formatRelativeTime('2026-06-15T11:55:00Z')).toBe('منذ 5 دقيقة')
  })

  it('returns hours for under a day', () => {
    expect(formatRelativeTime('2026-06-15T09:00:00Z')).toBe('منذ 3 ساعة')
  })

  it('returns days for under a week', () => {
    expect(formatRelativeTime('2026-06-10T12:00:00Z')).toBe('منذ 5 يوم')
  })

  it('falls back to the full date for older dates', () => {
    const out = formatRelativeTime('2026-05-20T12:00:00Z')
    expect(out).toContain('٢٠٢٦')
    expect(out).toContain('مايو')
  })

  it('accepts a Date object too', () => {
    expect(formatRelativeTime(new Date('2026-06-15T11:55:00Z'))).toBe('منذ 5 دقيقة')
  })
})
