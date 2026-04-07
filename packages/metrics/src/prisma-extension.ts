import { dbQueryDuration } from './index';

/**
 * Prisma Extension for automatic query duration metrics tracking.
 * This should be applied to the PrismaClient instance:
 * 
 * const prisma = new PrismaClient().$extends(prismaMetricsExtension('service-name'));
 */
export const prismaMetricsExtension = (serviceName: string) => {
  return {
    name: 'prisma-metrics',
    query: {
      $allOperations({ model, operation, args, query }: any) {
        const start = performance.now();
        return query(args).finally(() => {
          const end = performance.now();
          const elapsed = (end - start) / 1000;
          
          dbQueryDuration.observe({
            service: serviceName,
            model: model || 'none',
            operation: operation
          }, elapsed);
        });
      },
    },
  };
};

/**
 * Prisma Middleware for metrics tracking (legacy alternative to extensions)
 */
export const prismaMetricsMiddleware = (serviceName: string) => {
  return async (params: any, next: any) => {
    const start = performance.now();
    try {
      return await next(params);
    } finally {
      const end = performance.now();
      const elapsed = (end - start) / 1000;
      
      dbQueryDuration.observe({
        service: serviceName,
        model: params.model || 'none',
        operation: params.action
      }, elapsed);
    }
  };
};
