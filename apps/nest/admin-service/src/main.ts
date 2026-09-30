import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./shared/filters/global-exception.filter";
import { TraceInterceptor } from "./shared/interceptors/trace.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const corsOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Global error handling
  app.useGlobalInterceptors(new TraceInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());

  // Swagger UI requires @fastify/static — only register in development.
  // In production the /api/docs-json endpoint is still available for external
  // tools (Postman, ingress-hosted Swagger UI, etc.) without serving static assets.
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Admin Service API")
      .setDescription("Ain Rider Admin Service — internal API documentation")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = parseInt(process.env.PORT ?? "4003", 10);
  await app.listen(port, "0.0.0.0");

  console.log(
    JSON.stringify({
      level: "info",
      service: "admin-service",
      message: "Service started",
      port,
      swagger:
        process.env.NODE_ENV !== "production"
          ? `http://localhost:${port}/api/docs`
          : "disabled",
      timestamp: new Date().toISOString(),
    }),
  );
}

bootstrap();
