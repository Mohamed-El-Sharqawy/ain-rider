import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Logger } from 'pino';
import { createLogger, logDebug, logError, logInfo, logWarn } from '../src';
import { ValidationError } from '../src';

afterEach(() => {
  vi.unstubAllEnvs();
});

function stubLogger(): Logger & {
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
} {
  return {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as Logger & {
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    debug: ReturnType<typeof vi.fn>;
  };
}

describe('createLogger', () => {
  test('creates a pino logger named after the service with debug level by default outside production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const logger = createLogger({ serviceName: 'trip-service' });

    expect(logger.level).toBe('debug');
    expect(logger.bindings()).toMatchObject({ name: 'trip-service', serviceName: 'trip-service' });
  });

  test('defaults to info level in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = createLogger({ serviceName: 'auth-service' });

    expect(logger.level).toBe('info');
  });

  test('honors an explicit level', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = createLogger({ serviceName: 'auth-service', level: 'warn' });

    expect(logger.level).toBe('warn');
  });
});

describe('logError', () => {
  test('logs an Error with type, message, sanitized context, stack, details and code', () => {
    const logger = stubLogger();
    const error = new ValidationError('bad input', { field: 'phone', password: 'hunter2' });

    logError(logger, error, { traceId: '11111111-1111-4111-8111-111111111111', token: 'leak' });

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        errorType: 'ValidationError',
        message: 'bad input',
        stack: error.stack,
        details: { field: 'phone', password: '[REDACTED]' },
        code: 'VALIDATION_ERROR',
        traceId: '11111111-1111-4111-8111-111111111111',
        token: '[REDACTED]',
      }),
      'bad input',
    );
  });

  test('omits the stack in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const logger = stubLogger();
    const error = new Error('boom');

    logError(logger, error);

    const [payload] = logger.error.mock.calls[0];
    expect(payload.stack).toBeUndefined();
    expect(payload).toMatchObject({ errorType: 'Error', message: 'boom' });
  });

  test('handles non-Error throwables', () => {
    const logger = stubLogger();

    logError(logger, 'just a string', { traceId: 't-1' });

    expect(logger.error).toHaveBeenCalledExactlyOnceWith(
      { errorType: 'UnknownError', value: 'just a string', traceId: 't-1' },
      'An unknown error occurred',
    );
  });
});

describe('logInfo / logWarn / logDebug', () => {
  test.each([
    ['info', logInfo],
    ['warn', logWarn],
    ['debug', logDebug],
  ] as const)('log%s sanitizes the context before forwarding', (level, fn) => {
    const logger = stubLogger();

    fn(logger, 'something happened', { userId: 7, password: 'hunter2' });

    expect(logger[level]).toHaveBeenCalledExactlyOnceWith(
      { userId: 7, password: '[REDACTED]' },
      'something happened',
    );
  });

  test('defaults to an empty context', () => {
    const logger = stubLogger();

    logInfo(logger, 'no context');

    expect(logger.info).toHaveBeenCalledExactlyOnceWith({}, 'no context');
  });
});
