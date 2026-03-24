import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }) as any,
  );

  // Production-ready CORS configuration
  const allowedOrigins = process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:5173'];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'), false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Payment Service API')
      .setDescription('Ain Rider Payment Service — payment processing and refunds')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env.PAYMENT_SERVICE_PORT ?? '4002', 10);
  await app.listen(port, '0.0.0.0');

  console.log(
    JSON.stringify({
      level: 'info',
      service: 'payment-service',
      message: 'Service started',
      port,
      cors: allowedOrigins,
      swagger: process.env.NODE_ENV !== 'production' ? `http://localhost:${port}/api/docs` : 'disabled',
      timestamp: new Date().toISOString(),
    }),
  );
}

bootstrap();
