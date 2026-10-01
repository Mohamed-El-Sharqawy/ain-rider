import { Elysia } from 'elysia';
import { httpRequestDuration, httpRequestsTotal, register, initMetrics } from '../index';

export const metricsPlugin = (options: { serviceName: string }) => {
  initMetrics(options.serviceName);

  return new Elysia({ name: '@ain-rider/metrics' })
    .onBeforeHandle(({ _request, store }: any) => {
      (store as any).metricsStartTime = performance.now();
    })
    .onAfterHandle(({ request, set, path, store }) => {
      // Skip metrics for the metrics endpoint itself and dashboard
      if (path === '/metrics' || path.endsWith('/metrics') || path === '/dashboard/metrics') return;

      const start = (store as any).metricsStartTime;
      const end = performance.now();
      const elapsed = (end - start) / 1000;

      const labels = {
        service: options.serviceName,
        method: request.method,
        route: path || 'unknown',
        status_code: String(set.status || 200)
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, elapsed);
    })
    .onError(({ request, set, path, store, error }) => {
      // Skip metrics for the metrics endpoint itself and dashboard
      if (path === '/metrics' || path.endsWith('/metrics') || path === '/dashboard/metrics') return;

      const start = (store as any).metricsStartTime;
      const elapsed = start ? (performance.now() - start) / 1000 : 0;

      // Elysia leaves set.status at 200 for router-level errors (e.g. 404),
      // so prefer the status carried by the error object itself.
      const statusCode = (error as { status?: number } | undefined)?.status ?? set.status ?? 500;

      const labels = {
        service: options.serviceName,
        method: request.method,
        route: path || 'unknown',
        status_code: String(statusCode)
      };

      httpRequestsTotal.inc(labels);
      httpRequestDuration.observe(labels, elapsed);
    })
    .get('/metrics', async () => {
      return new Response(await register.metrics(), {
        headers: { 'Content-Type': register.contentType },
      });
    });
};
