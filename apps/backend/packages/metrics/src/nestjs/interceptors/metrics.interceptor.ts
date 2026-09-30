import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { httpRequestDuration, httpRequestsTotal } from '../../index';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private static serviceName: string = 'unknown';

  static setServiceName(name: string) {
    this.serviceName = name;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const start = performance.now();
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    return next.handle().pipe(
      tap(() => {
        const elapsed = (performance.now() - start) / 1000;
        const labels = this.getLabels(request, response);
        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, elapsed);
      }),
      catchError((error) => {
        const elapsed = (performance.now() - start) / 1000;
        // NestJS errors often don't have status yet, so we assume 500 or extract
        const statusCode = error?.status || error?.statusCode || 500;
        const labels = this.getLabels(request, { ...response, statusCode });

        httpRequestsTotal.inc(labels);
        httpRequestDuration.observe(labels, elapsed);
        throw error;
      })
    );
  }

  private getLabels(request: any, response: any) {
    return {
      service: MetricsInterceptor.serviceName,
      method: request.method,
      // Extract route path if possible (NestJS uses router)
      route: request.route?.path || request.originalUrl || 'unknown',
      status_code: String(response.statusCode || 200)
    };
  }
}
