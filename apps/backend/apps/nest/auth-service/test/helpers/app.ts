import { ValidationPipe } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import multipart from "@fastify/multipart";
import { AppModule } from "../../src/app.module";
import { GlobalExceptionFilter } from "../../src/shared/filters/global-exception.filter";
import { TraceInterceptor } from "../../src/shared/interceptors/trace.interceptor";

/**
 * Boots the full AppModule on a Fastify adapter with the same global
 * wiring as src/main.ts (multipart, validation pipe, trace interceptor,
 * exception filter) so tests exercise the real HTTP contract via
 * app.inject() without binding a port.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024,
      files: 5,
    },
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TraceInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.init();
  return app;
}
