import { Module, DynamicModule, Global } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { initMetrics } from '../index';
import { MetricsController } from './controllers/metrics.controller';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

@Global()
@Module({})
export class MetricsModule {
  static forRoot(options: { serviceName: string }): DynamicModule {
    initMetrics(options.serviceName);
    MetricsInterceptor.setServiceName(options.serviceName);

    return {
      module: MetricsModule,
      controllers: [MetricsController],
      providers: [
        {
          provide: APP_INTERCEPTOR,
          useClass: MetricsInterceptor,
        },
      ],
      exports: [],
    };
  }
}
