import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { FetchInternalConfig } from '../src/types';

type IncCall = { service: string; status: string };

function jsonResponse(status = 200): Response {
  return new Response('{"ok":true}', { status });
}

function makeHooks() {
  return {
    metrics: { inc: vi.fn() },
    logger: { error: vi.fn() },
  };
}

function configWith(overrides: Partial<FetchInternalConfig> = {}): FetchInternalConfig {
  return {
    serviceName: 'api-gateway',
    metrics: undefined,
    logger: undefined,
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('fetchInternal', () => {
  test('sends a plain GET with defaults when nothing is configured', async () => {
    vi.resetModules();
    const { fetchInternal } = await import('../src');
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchInternal('http://auth.internal/health');

    expect(res.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith('http://auth.internal/health', {
      method: 'GET',
      headers: {},
      body: undefined,
    });
  });

  test('attaches the internal secret, custom headers and reports attempt/success metrics', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    const hooks = makeHooks();
    configureFetchInternal(configWith({ internalSecret: 's3cret', ...hooks }));
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchInternal('http://auth/internal/me', 'POST', { current: true }, {
      targetService: 'auth-service',
      headers: { 'X-Custom': 'yes' },
    });

    expect(res).toBeInstanceOf(Response);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://auth/internal/me');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'X-Custom': 'yes', 'x-internal-secret': 's3cret', 'Content-Type': 'application/json' });
    expect(init.body).toBe(JSON.stringify({ current: true }));

    const statuses = (hooks.metrics.inc.mock.calls as unknown as IncCall[][]).map(([{ status }]) => status);
    expect(statuses).toEqual(['attempt', 'success']);
  });

  test('reports error metric for non-2xx responses', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    const hooks = makeHooks();
    configureFetchInternal(configWith(hooks));
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(503)));

    const res = await fetchInternal('http://trip/internal/active', 'GET');

    expect(res.status).toBe(503);
    const statuses = (hooks.metrics.inc.mock.calls as unknown as IncCall[][]).map(([{ status }]) => status);
    expect(statuses).toEqual(['attempt', 'error']);
  });

  test('honors an existing Content-Type header instead of forcing json', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    configureFetchInternal(configWith());
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await fetchInternal('http://x/', 'POST', { a: 1 }, { headers: { 'Content-Type': 'text/plain' } });
    await fetchInternal('http://x/', 'POST', { a: 1 }, { headers: { 'content-type': 'text/plain' } });

    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('text/plain');
    expect(fetchMock.mock.calls[1][1].headers).toEqual({ 'content-type': 'text/plain' });
    expect(fetchMock.mock.calls[0][1].body).toBe(JSON.stringify({ a: 1 }));
  });

  test('passes raw body types through untouched', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    configureFetchInternal(configWith());
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    const rawBodies = [
      'raw string',
      new ArrayBuffer(8),
      new Uint8Array([1, 2, 3]),
      new FormData(),
      new Blob(['blob']),
      new ReadableStream(),
    ];

    for (const body of rawBodies) {
      await fetchInternal('http://x/', 'POST', body);
    }

    const sentBodies = fetchMock.mock.calls.map(([, init]) => init.body);
    expect(sentBodies).toEqual(rawBodies);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(init.headers).toEqual({});
    }
  });

  test('drops the body for GET, HEAD and undefined bodies', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    configureFetchInternal(configWith());
    const fetchMock = vi.fn(async () => jsonResponse());
    vi.stubGlobal('fetch', fetchMock);

    await fetchInternal('http://x/', 'GET', { ignored: true });
    await fetchInternal('http://x/', 'HEAD', { ignored: true });
    await fetchInternal('http://x/', 'POST');

    expect(fetchMock.mock.calls.map(([, init]) => init.body)).toEqual([undefined, undefined, undefined]);
  });

  test('retries transport failures with exponential backoff until success', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    const hooks = makeHooks();
    configureFetchInternal(configWith(hooks));
    const final = jsonResponse();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET 1'))
      .mockRejectedValueOnce(new Error('ECONNRESET 2'))
      .mockResolvedValueOnce(final);
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchInternal('http://x/flaky', 'GET');
    await vi.advanceTimersByTimeAsync(200);
    await vi.advanceTimersByTimeAsync(400);
    await expect(pending).resolves.toBe(final);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const statuses = (hooks.metrics.inc.mock.calls as unknown as IncCall[][]).map(([{ status }]) => status);
    expect(statuses).toEqual(['attempt', 'success']);
  });

  test('gives up after three attempts: throws, logs and reports the failure', async () => {
    vi.resetModules();
    const { configureFetchInternal, fetchInternal } = await import('../src');
    const hooks = makeHooks();
    configureFetchInternal(configWith({ internalSecret: 's', ...hooks }));
    const boom = new Error('connection refused');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(boom));

    const pending = fetchInternal('http://x/gone', 'DELETE', { id: 9 }, { targetService: 'trip-service' });
    const assertion = expect(pending).rejects.toBe(boom);
    await vi.runAllTimersAsync();
    await assertion;

    expect(hooks.logger.error).toHaveBeenCalledExactlyOnceWith(
      '[api-gateway] Proxy to trip-service failed after 3 attempts',
      { url: 'http://x/gone', method: 'DELETE', error: 'Error: connection refused' },
    );
    const statuses = (hooks.metrics.inc.mock.calls as unknown as IncCall[][]).map(([{ status }]) => status);
    expect(statuses).toEqual(['attempt', 'failed']);
  });

  test('fails silently when neither logger nor metrics are configured', async () => {
    vi.resetModules();
    const { fetchInternal } = await import('../src');
    const boom = new Error('dns failure');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(boom));

    const pending = fetchInternal('http://nowhere/');
    const assertion = expect(pending).rejects.toBe(boom);
    await vi.runAllTimersAsync();
    await assertion;
  });
});
