import 'reflect-metadata';
import { describe, expect, test, vi } from 'vitest';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { promRegister as register } from '../../src';
import { MetricsModule } from '../../src/nestjs/metrics.module';
import { MetricsInterceptor } from '../../src/nestjs/interceptors/metrics.interceptor';
import { MetricsController } from '../../src/nestjs/controllers/metrics.controller';
import { httpRequestsTotal } from '../../src';

describe('MetricsModule.forRoot', () => {
  test('initializes metrics, names the interceptor and wires controller plus global interceptor', async () => {
    vi.useFakeTimers();
    try {
      const dynamicModule = MetricsModule.forRoot({ serviceName: 'metrics-module-service' });

      expect(dynamicModule.module).toBe(MetricsModule);
      expect(dynamicModule.controllers).toEqual([MetricsController]);
      expect(dynamicModule.providers).toEqual([
        { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor },
      ]);
      expect(dynamicModule.exports).toEqual([]);

      expect(
        register.getSingleMetric('metrics_module_service_process_cpu_user_seconds_total'),
      ).toBeDefined();

      const interceptor = new MetricsInterceptor();
      const inc = vi.spyOn(httpRequestsTotal, 'inc').mockReturnValue(undefined);
      const context = {
        getType: () => 'http',
        switchToHttp: () => ({
          getRequest: () => ({ method: 'GET', route: { path: '/x' } }),
          getResponse: () => ({ statusCode: 200 }),
        }),
      } as never;

      const result = await firstValueFrom(
        interceptor.intercept(context, { handle: () => of('ok') } as never),
      );

      expect(result).toBe('ok');
      expect(inc.mock.calls[0][0]).toMatchObject({ service: 'metrics-module-service' });
    } finally {
      vi.useRealTimers();
      vi.restoreAllMocks();
    }
  });
});
