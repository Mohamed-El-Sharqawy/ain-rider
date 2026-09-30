/** Result of a multi-field form validation. */
export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/** Validates a promo code format (uppercase alphanumeric, 3-20 chars). Returns Arabic error or null. */
export const validatePromoCode = (code: string): string | null => {
  if (!code || code.trim().length === 0) {
    return 'كود الخصم مطلوب';
  }
  if (code.length < 3) {
    return 'كود الخصم يجب أن يكون 3 أحرف على الأقل';
  }
  if (code.length > 20) {
    return 'كود الخصم يجب أن لا يتجاوز 20 حرف';
  }
  if (!/^[A-Z0-9]+$/.test(code)) {
    return 'كود الخصم يجب أن يحتوي على أحرف إنجليزية وأرقام فقط';
  }
  return null;
};

/** Validates a discount value based on type (PERCENTAGE or FIXED in IQD). */
export const validateDiscountValue = (value: number, type: 'PERCENTAGE' | 'FIXED'): string | null => {
  if (isNaN(value) || value <= 0) {
    return 'قيمة الخصم مطلوبة ويجب أن تكون أكبر من صفر';
  }
  if (type === 'PERCENTAGE' && value > 100) {
    return 'النسبة المئوية يجب أن لا تتجاوز 100%';
  }
  if (type === 'FIXED' && value > 1000000) {
    return 'المبلغ يجب أن لا يتجاوز 1,000,000 دينار';
  }
  return null;
};

/** Validates a usage limit (1-100,000). */
export const validateUsageLimit = (limit: number): string | null => {
  if (isNaN(limit) || limit < 1) {
    return 'الحد الأقصى للاستخدامات مطلوب ويجب أن يكون على الأقل 1';
  }
  if (limit > 100000) {
    return 'الحد الأقصى للاستخدامات يجب أن لا يتجاوز 100,000';
  }
  return null;
};

/** Validates that validFrom is before validUntil. Passes if either is missing. */
export const validateDateRange = (validFrom?: string, validUntil?: string): string | null => {
  if (!validFrom && !validUntil) {
    return null;
  }
  if (validFrom && validUntil) {
    const fromDate = new Date(validFrom);
    const untilDate = new Date(validUntil);
    if (fromDate >= untilDate) {
      return 'تاريخ البداية يجب أن يكون قبل تاريخ النهاية';
    }
  }
  return null;
};

/** Validates an Iraqi phone number (+964 or local 07xx format). */
export const validatePhoneNumber = (phone: string): string | null => {
  if (!phone || phone.trim().length === 0) {
    return 'رقم الهاتف مطلوب';
  }
  const iraqiPhoneRegex = /^\+964(7[3-9]\d{8})$/;
  const localPhoneRegex = /^0?(7[3-9]\d{8})$/;
  if (!iraqiPhoneRegex.test(phone) && !localPhoneRegex.test(phone)) {
    return 'رقم الهاتف يجب أن يكون رقم عراقي صالح (مثال: +9647901234567)';
  }
  return null;
};

/** Validates an email address format. */
export const validateEmail = (email: string): string | null => {
  if (!email || email.trim().length === 0) {
    return 'البريد الإلكتروني مطلوب';
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return 'البريد الإلكتروني غير صالح';
  }
  return null;
};

/** Validates that a required string field is non-empty. Uses the Arabic fieldName in the error. */
export const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim().length === 0) {
    return `${fieldName} مطلوب`;
  }
  return null;
};

/** Validates resolution text is provided when resolving a complaint (min 10 chars). */
export const validateComplaintResolution = (status: string, resolution: string): string | null => {
  if (status === 'RESOLVED') {
    if (!resolution || resolution.trim().length === 0) {
      return 'ملاحظات الحل مطلوبة عند إغلاق الشكوى';
    }
    if (resolution.trim().length < 10) {
      return 'ملاحظات الحل يجب أن تكون 10 أحرف على الأقل';
    }
  }
  return null;
};

/** Validates a complaint status transition follows allowed rules (RESOLVED is terminal). */
export const validateStatusTransition = (currentStatus: string, newStatus: string): string | null => {
  const validTransitions: Record<string, string[]> = {
    PENDING: ['IN_PROGRESS', 'RESOLVED'],
    IN_PROGRESS: ['PENDING', 'RESOLVED'],
    RESOLVED: [],
  };

  if (!validTransitions[currentStatus]?.includes(newStatus)) {
    return `لا يمكن تغيير الحالة من "${currentStatus}" إلى "${newStatus}"`;
  }
  return null;
};

/** Normalizes a phone number to +964 international format. */
export const formatPhoneNumber = (phone: string): string => {
  let cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '+964' + cleaned.substring(1);
  }
  if (!cleaned.startsWith('+')) {
    cleaned = '+964' + cleaned;
  }
  return cleaned;
};
