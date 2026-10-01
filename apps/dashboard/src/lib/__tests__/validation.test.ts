import { describe, it, expect } from 'vitest'
import {
  validatePromoCode,
  validateDiscountValue,
  validateUsageLimit,
  validateDateRange,
  validatePhoneNumber,
  validateEmail,
  validateRequired,
  validateComplaintResolution,
  validateStatusTransition,
  formatPhoneNumber,
} from '../validation'

describe('validatePromoCode', () => {
  it('accepts a valid uppercase code', () => {
    expect(validatePromoCode('SUMMER2026')).toBeNull()
  })

  it('rejects an empty code', () => {
    expect(validatePromoCode('   ')).toBe('كود الخصم مطلوب')
  })

  it('rejects codes shorter than 3 chars', () => {
    expect(validatePromoCode('AB')).toBe('كود الخصم يجب أن يكون 3 أحرف على الأقل')
  })

  it('rejects codes longer than 20 chars', () => {
    expect(validatePromoCode('A'.repeat(21))).toBe('كود الخصم يجب أن لا يتجاوز 20 حرف')
  })

  it('rejects non-alphanumeric characters', () => {
    expect(validatePromoCode('SUMMER-26')).toBe(
      'كود الخصم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط',
    )
  })
})

describe('validateDiscountValue', () => {
  it('rejects zero and NaN', () => {
    expect(validateDiscountValue(0, 'FIXED')).toBe(
      'قيمة الخصم مطلوبة ويجب أن تكون أكبر من صفر',
    )
    expect(validateDiscountValue(NaN, 'FIXED')).toBe(
      'قيمة الخصم مطلوبة ويجب أن تكون أكبر من صفر',
    )
  })

  it('caps percentages at 100', () => {
    expect(validateDiscountValue(101, 'PERCENTAGE')).toBe('النسبة المئوية يجب أن لا تتجاوز 100%')
    expect(validateDiscountValue(100, 'PERCENTAGE')).toBeNull()
  })

  it('caps fixed amounts at 1,000,000 EGP', () => {
    expect(validateDiscountValue(1_000_001, 'FIXED')).toBe(
      'المبلغ يجب أن لا يتجاوز 1,000,000 جنيه',
    )
    expect(validateDiscountValue(1_000_000, 'FIXED')).toBeNull()
  })
})

describe('validateUsageLimit', () => {
  it('requires at least 1', () => {
    expect(validateUsageLimit(0)).toBe('الحد الأقصى للاستخدامات مطلوب ويجب أن يكون على الأقل 1')
    expect(validateUsageLimit(NaN)).toBe('الحد الأقصى للاستخدامات مطلوب ويجب أن يكون على الأقل 1')
  })

  it('caps at 100,000', () => {
    expect(validateUsageLimit(100_001)).toBe('الحد الأقصى للاستخدامات يجب أن لا يتجاوز 100,000')
    expect(validateUsageLimit(100_000)).toBeNull()
  })
})

describe('validateDateRange', () => {
  it('passes when either bound is missing', () => {
    expect(validateDateRange(undefined, '2026-01-01')).toBeNull()
    expect(validateDateRange('2026-01-01')).toBeNull()
    expect(validateDateRange()).toBeNull()
  })

  it('passes for a valid ordered range', () => {
    expect(validateDateRange('2026-01-01', '2026-02-01')).toBeNull()
  })

  it('rejects an end date on or before the start date', () => {
    expect(validateDateRange('2026-02-01', '2026-01-01')).toBe(
      'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
    )
    expect(validateDateRange('2026-01-01', '2026-01-01')).toBe(
      'تاريخ البداية يجب أن يكون قبل تاريخ النهاية',
    )
  })
})

describe('validatePhoneNumber', () => {
  it('accepts +20 international format', () => {
    expect(validatePhoneNumber('+201001234567')).toBeNull()
    expect(validatePhoneNumber('+201212345678')).toBeNull()
  })

  it('accepts local 01x format with or without leading 0', () => {
    expect(validatePhoneNumber('01001234567')).toBeNull()
    expect(validatePhoneNumber('1001234567')).toBeNull()
  })

  it('rejects an empty phone', () => {
    expect(validatePhoneNumber('  ')).toBe('رقم الهاتف مطلوب')
  })

  it('rejects a non-Egyptian number', () => {
    expect(validatePhoneNumber('+447911123456')).toBe(
      'رقم الهاتف يجب أن يكون رقم مصري صالح (مثال: +201001234567)',
    )
  })
})

describe('validateEmail', () => {
  it('accepts a well-formed email', () => {
    expect(validateEmail('admin@ainrider.com')).toBeNull()
  })

  it('rejects an empty email', () => {
    expect(validateEmail(' ')).toBe('البريد الإلكتروني مطلوب')
  })

  it('rejects a malformed email', () => {
    expect(validateEmail('not-an-email')).toBe('البريد الإلكتروني غير صالح')
  })
})

describe('validateRequired', () => {
  it('returns null for a non-empty value', () => {
    expect(validateRequired('value', 'الاسم')).toBeNull()
  })

  it('returns an Arabic error naming the field for blank input', () => {
    expect(validateRequired('  ', 'الاسم')).toBe('الاسم مطلوب')
  })
})

describe('validateComplaintResolution', () => {
  it('ignores resolution for non-resolved statuses', () => {
    expect(validateComplaintResolution('IN_PROGRESS', '')).toBeNull()
  })

  it('requires resolution text when resolving', () => {
    expect(validateComplaintResolution('RESOLVED', '  ')).toBe(
      'ملاحظات الحل مطلوبة عند إغلاق الشكوى',
    )
  })

  it('requires at least 10 characters', () => {
    expect(validateComplaintResolution('RESOLVED', 'قصيرة')).toBe(
      'ملاحظات الحل يجب أن تكون 10 أحرف على الأقل',
    )
    expect(validateComplaintResolution('RESOLVED', '0123456789')).toBeNull()
  })
})

describe('validateStatusTransition', () => {
  it('allows documented transitions', () => {
    expect(validateStatusTransition('PENDING', 'IN_PROGRESS')).toBeNull()
    expect(validateStatusTransition('IN_PROGRESS', 'RESOLVED')).toBeNull()
  })

  it('rejects transitions out of a terminal status', () => {
    expect(validateStatusTransition('RESOLVED', 'PENDING')).toBe(
      'لا يمكن تغيير الحالة من "RESOLVED" إلى "PENDING"',
    )
  })

  it('rejects unknown statuses', () => {
    expect(validateStatusTransition('NOPE', 'PENDING')).toBe(
      'لا يمكن تغيير الحالة من "NOPE" إلى "PENDING"',
    )
  })
})

describe('formatPhoneNumber', () => {
  it('normalizes a local number to +20 international format', () => {
    expect(formatPhoneNumber('01001234567')).toBe('+201001234567')
  })

  it('strips separators before normalizing', () => {
    expect(formatPhoneNumber('(010) 012-34567')).toBe('+201001234567')
  })

  it('prefixes +20 to a bare subscriber number', () => {
    expect(formatPhoneNumber('1001234567')).toBe('+201001234567')
  })

  it('leaves an already-international number untouched', () => {
    expect(formatPhoneNumber('+201001234567')).toBe('+201001234567')
  })
})
