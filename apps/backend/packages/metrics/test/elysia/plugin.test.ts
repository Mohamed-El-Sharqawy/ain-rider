import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { httpRequestDuration, httpRequestsTotal, promRegister as register } from '../../src';

type HookContext = {
  request: { method: string };
  set: { status?: number };
  path: string;
  store: Record<string, unknown>;
  error?: unknown;
};

const FakeElysia = vi.hoisted(() => {
  class FakeElysia {
    readonly registeredGets: Array<{ path: string; handler: () => unknown }> = [];
    private beforeHandle?: (ctx: { _request: unknown; store: Record<string, unknown> }) => void;
    private afterHandle?: (ctx: any) => void;
    private errorHandler?: (ctx: any) => void;

    constructor(_options?: Record<string, unknown>) {}

    onBeforeHandle(fn: (ctx: { _request: unknown; store: Record<string, unknown> }) => void) {
      this.beforeHandle = fn;
      return this;
    }

    onAfterHandle(fn: (ctx: any) => void) {
      this.afterHandle = fn;
      return this;
    }

    onError(fn: (ctx: any) => void) {
      this.errorHandler = fn;
      return this;
    }

    get(path: string, handler: () => unknown) {
      this.registeredGets.push({ path, handler });
      return this;
    }

    before(store: Record<string, unknown> = {}) {
      this.beforeHandle?.({ _request: {}, store });
    }

    after(ctx: Partial<HookContext> & { store: Record<string, unknown> }) {
      this.afterHandle?.({ request: { method: 'GET' }, set: {}, path: '/', error: undefined, ...ctx });
    }

    error(ctx: Partial<HookContext> & { store: Record<string, unknown> }) {
      this.errorHandler?.({ request: { method: 'GET' }, set: {}, path: '/', error: undefined, ...ctx });
    }

    getHandler(path: string) {
      const entry = this.registeredGets.find((g) => g.path === path);
      if (!entry) throw new Error(`no route registered for ${path}`);
      return entry.handler;
    }
  }

  return FakeElysia;
});

vi.mock('elysia', () => ({ Elysia: FakeElysia }));

const { metricsPlugin } = await import('../../src/elysia/plugin');

let pluginSeq = 0;
let currentServiceName = '';

// Every plugin instance calls initMetrics which registers default metrics under
// a prefix derived from the service name, so each instance needs a unique name.
function freshPlugin(serviceName?: string) {
  currentServiceName = serviceName ?? `elysia-plugin-${++pluginSeq}`;
  return metricsPlugin({ serviceName: currentServiceName }) as unknown as InstanceType<typeof FakeElysia>;
}

describe('metricsPlugin', () => {
  let inc: ReturnType<typeof vi.spyOn>;
  let observe: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    inc = vi.spyOn(httpRequestsTotal, 'inc').mockReturnValue(undefined);
    observe = vi.spyOn(httpRequestDuration, 'observe').mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('initializes metrics and registers the metrics scrape route', async () => {
    const plugin = freshPlugin('elysia-init-service');

    expect(register.getSingleMetric('elysia_init_service_process_cpu_user_seconds_total')).toBeDefined();

    const handler = plugin.getHandler('/metrics');
    const response = (await handler()) as Response;

    expect(response).toBeInstanceOf(Response);
    expect(response.headers.get('Content-Type')).toBe(register.contentType);
    expect(typeof (await response.text())).toBe('string');
  });

  describe('onAfterHandle', () => {
    test('records the request count and duration with route and status labels', () => {
      const plugin = freshPlugin();
      const store: Record<string, unknown> = {};

      plugin.before(store);
      plugin.after({ store, path: '/rides', set: { status: 201 } });

      expect(inc).toHaveBeenCalledExactlyOnceWith({
        service: currentServiceName,
        method: 'GET',
        route: '/rides',
        status_code: '201',
      });
      expect(observe).toHaveBeenCalledExactlyOnceWith(
        { service: currentServiceName, method: 'GET', route: '/rides', status_code: '201' },
        expect.any(Number),
      );
      expect(observe.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
    });

    test('defaults the status code to 200 when set.status is missing', () => {
      const plugin = freshPlugin();
      const store: Record<string, unknown> = { metricsStartTime: performance.now() };

      plugin.after({ store, path: '/health' });

      expect(inc.mock.calls[0][0]).toMatchObject({ status_code: '200' });
    });

    test('falls back to the unknown route label for empty paths', () => {
      const plugin = freshPlugin();
      const store: Record<string, unknown> = { metricsStartTime: performance.now() };

      plugin.after({ store, path: '' });

      expect(inc.mock.calls[0][0]).toMatchObject({ route: 'unknown' });
    });

    test.each(['/metrics', '/sub/metrics', '/dashboard/metrics'])(
      'skips recording for the metrics path %s',
      (path) => {
        const plugin = freshPlugin();
        const store: Record<string, unknown> = { metricsStartTime: performance.now() };

        plugin.after({ store, path });

        expect(inc).not.toHaveBeenCalled();
        expect(observe).not.toHaveBeenCalled();
      },
    );
  });

  describe('onError', () => {
    test('prefers the status carried by the error object over set.status', () => {
      const plugin = freshPlugin();
      const store: Record<string, unknown> = { metricsStartTime: performance.now() };

      plugin.error({ store, path: '/gone', error: { status: 404 }, set: { status: 200 } });

      expect(inc).toHaveBeenCalledExactlyOnceWith({
        service: currentServiceName,
        method: 'GET',
        route: '/gone',
        status_code: '404',
      });
      expect(observe).toHaveBeenCalledExactlyOnceWith(
        { service: currentServiceName, method: 'GET', route: '/gone', status_code: '404' },
        expect.any(Number),
      );
    });

    test('uses set.status for plain errors without a status and measures elapsed time', () => {
      const plugin = freshPlugin();
      const store: Record<string, unknown> = { metricsStartTime: performance.now() };

      plugin.error({ store, path: '/boom', error: new Error('boom'), set: { status: 500 } });

      expect(inc.mock.calls[0][0]).toMatchObject({ status_code: '500' });
      expect(observe.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
    });

    test('falls back to 500 when neither the error nor set carry a status', () => {
      const plugin = freshPlugin();

      plugin.error({ store: {}, path: '/unhandled', error: undefined, set: {} });

      expect(inc.mock.calls[0][0]).toMatchObject({ status_code: '500' });
      expect(observe.mock.calls[0][1]).toBe(0);
    });

    test('falls back to the unknown route label for empty error paths', () => {
      const plugin = freshPlugin();

      plugin.error({ store: { metricsStartTime: performance.now() }, path: '', error: new Error('x') });

      expect(inc.mock.calls[0][0]).toMatchObject({ route: 'unknown' });
    });

    test.each(['/metrics', '/sub/metrics', '/dashboard/metrics'])(
      'skips recording for the metrics path %s',
      (path) => {
        const plugin = freshPlugin();
        const store: Record<string, unknown> = { metricsStartTime: performance.now() };

        plugin.error({ store, path, error: new Error('x') });

        expect(inc).not.toHaveBeenCalled();
        expect(observe).not.toHaveBeenCalled();
      },
    );
  });
});
