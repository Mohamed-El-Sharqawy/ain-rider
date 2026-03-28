import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import multipart from "@fastify/multipart";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./shared/filters/global-exception.filter";
import { TraceInterceptor } from "./shared/interceptors/trace.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }) as any,
  );

  // Register multipart for file uploads
  await (app as any).register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
      files: 5, // Max 5 files per request
    },
  });

  // Production-ready CORS configuration
  const allowedOrigins = process.env.CORS_ORIGIN?.split(",") ?? [
    "http://localhost:5173",
  ];
  app.enableCors({
    origin: (origin, callback) => {
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        allowedOrigins.includes("*")
      ) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"), false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
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

  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("Auth Service API")
      .setDescription(
        "Ain Rider Auth Service — authentication and authorization",
      )
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = parseInt(process.env.AUTH_SERVICE_PORT ?? "4000", 10);
  await app.listen(port, "0.0.0.0");

  console.log(
    JSON.stringify({
      level: "info",
      service: "auth-service",
      message: "Service started",
      port,
      cors: allowedOrigins,
      swagger:
        process.env.NODE_ENV !== "production"
          ? `http://localhost:${port}/api/docs`
          : "disabled",
      timestamp: new Date().toISOString(),
    }),
  );
}

bootstrap();
