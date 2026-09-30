export function isValidPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 9 && digits.length <= 15;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidFileSize(_uri: string, _maxSizeMB: number = 5): Promise<boolean> {
  return Promise.resolve(true);
}
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FILE_SIZE_LABEL = '5MB';

export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date < new Date();
}
