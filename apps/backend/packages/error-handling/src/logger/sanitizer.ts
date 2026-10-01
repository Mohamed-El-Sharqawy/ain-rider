/**
 * Sensitive data sanitizer for logging and error responses.
 * Automatically redacts values matching sensitive patterns.
 */

/**
 * Patterns for sensitive data that should be redacted.
 */
const SENSITIVE_PATTERNS = [
  /password/i,
  /token/i,
  /secret/i,
  /key/i,
  /authorization/i,
  /credential/i,
  /apikey/i,
  /api_key/i,
  /bearer/i,
];

const REDACTED_VALUE = '[REDACTED]';

/**
 * Checks if a key matches any sensitive pattern.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

/**
 * Recursively sanitizes an object by redacting sensitive values.
 * @param obj - The object to sanitize
 * @returns A new object with sensitive values redacted
 */
export function sanitize(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitize(item));
  }

  // Dates have no enumerable own properties; keep them intact
  if (obj instanceof Date) {
    return obj;
  }

  const sanitized: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveKey(key)) {
      sanitized[key] = REDACTED_VALUE;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitize(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Sanitizes a string by replacing sensitive patterns.
 * @param str - The string to sanitize
 * @returns The sanitized string
 */
export function sanitizeString(str: string): string {
  let result = str;
  
  // Redact common sensitive patterns in strings
  const patterns = [
    /password[=:]\s*\S+/gi,
    /token[=:]\s*\S+/gi,
    /secret[=:]\s*\S+/gi,
    /api[_-]?key[=:]\s*\S+/gi,
    /bearer\s+\S+/gi,
    // Consume an optional auth scheme + credential pair (e.g. "Basic dXNlcjpwYXNz")
    /authorization[=:]\s*\S+(\s+\S+)?/gi,
  ];

  for (const pattern of patterns) {
    result = result.replace(pattern, (match) => {
      const parts = match.split(/[=:]\s*/);
      if (parts.length === 2) {
        return `${parts[0]}: ${REDACTED_VALUE}`;
      }
      return REDACTED_VALUE;
    });
  }

  return result;
}
