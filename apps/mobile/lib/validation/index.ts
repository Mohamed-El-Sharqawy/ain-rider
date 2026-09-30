export function isValidPhone(phone: string): boolean {
  // Egyptian mobile in E.164 format: +20 followed by 10 digits starting with 010/011/012/015
  return /^\+201[0125]\d{8}$/.test(phone);
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
