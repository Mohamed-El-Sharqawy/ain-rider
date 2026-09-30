# Phase 4: NestJS Services Setup

**Estimated Time**: 3 hours  
**Prerequisites**: Phase 1, 2, 3 completed, NestJS CLI 11+ installed

---

## Objectives

Build 4 NestJS/Node services with Prisma ORM:

1. **auth-service** - User/driver authentication, JWT issuance
2. **trip-service** - Trip lifecycle management
3. **payment-service** - Payment processing and ledger
4. **admin-service** - Admin dashboard and analytics

---

## Service 1: Auth Service

### Step 1.1: Scaffold Service

```bash
cd apps/nest
nest new auth-service --package-manager pnpm --skip-git
cd auth-service
```

### Step 1.2: Install Dependencies

```bash
pnpm add @nestjs/platform-fastify @nestjs/config @nestjs/microservices @nestjs/terminus
pnpm add @nestjs/jwt @nestjs/passport passport-jwt bcrypt
pnpm add ioredis nats prom-client
pnpm add @prisma/client @ain-rider/shared-types@workspace:* @ain-rider/nats-client@workspace:* @ain-rider/redis-client@workspace:*
pnpm add -D prisma @types/bcrypt @types/passport-jwt
```

### Step 1.3: Initialize Prisma

```bash
npx prisma init
```

Create `apps/nest/auth-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  phoneNumber  String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         String   // RIDER, DRIVER, ADMIN
  status       String   @default("ACTIVE")
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}

model Driver {
  id            String   @id @default(uuid())
  userId        String   @unique
  vehicleId     String?
  licenseNumber String   @unique
  rating        Float    @default(5.0)
  totalTrips    Int      @default(0)
  isOnline      Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("drivers")
}
```

### Step 1.4: Create Prisma Service

Create `apps/nest/auth-service/src/prisma/prisma.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
    console.log('[Prisma] Connected to database');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    console.log('[Prisma] Disconnected from database');
  }
}
```

Create `apps/nest/auth-service/src/prisma/prisma.module.ts`:

```typescript
import { Module, Global } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

### Step 1.5: Implement Auth Service

Create `apps/nest/auth-service/src/auth/auth.service.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { UserRole } from '@ain-rider/shared-types';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async register(data: {
    email: string;
    phoneNumber: string;
    password: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  }) {
    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        phoneNumber: data.phoneNumber,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
      },
    });

    // If driver, create driver profile
    if (data.role === UserRole.DRIVER) {
      await this.prisma.driver.create({
        data: {
          userId: user.id,
          licenseNumber: '', // To be updated later
        },
      });
    }

    const token = this.generateToken(user);

    return { user: this.sanitizeUser(user), token };
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const token = this.generateToken(user);

    return { user: this.sanitizeUser(user), token };
  }

  async validateUser(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  private generateToken(user: any) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.sign(payload);
  }

  private sanitizeUser(user: any) {
    const { passwordHash, ...sanitized } = user;
    return sanitized;
  }
}
```

Create `apps/nest/auth-service/src/auth/auth.controller.ts`:

```typescript
import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    return this.authService.login(body.email, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@Request() req: any) {
    return req.user;
  }
}
```

Create `apps/nest/auth-service/src/auth/jwt.strategy.ts`:

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }
}
```

Create `apps/nest/auth-service/src/auth/jwt-auth.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

Create `apps/nest/auth-service/src/auth/auth.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
```

### Step 1.6: Update Main Module

Edit `apps/nest/auth-service/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    PrismaModule,
    AuthModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
```

### Step 1.7: Create Health Controller

Create `apps/nest/auth-service/src/health/health.controller.ts`:

```typescript
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('ready')
  ready() {
    return { status: 'ready', service: 'auth-service' };
  }
}
```

### Step 1.8: Update Main.ts for Fastify

Edit `apps/nest/auth-service/src/main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.enableCors();

  const port = parseInt(process.env.AUTH_SERVICE_PORT || '4000');
  await app.listen(port, '0.0.0.0');

  console.log(`🚀 Auth Service running at http://localhost:${port}`);
}
bootstrap();
```

### Step 1.9: Update Package.json Scripts

Edit `apps/nest/auth-service/package.json` scripts:

```json
{
  "scripts": {
    "prebuild": "rimraf dist",
    "build": "prisma generate && nest build",
    "start": "nest start",
    "start:dev": "nest start --watch",
    "start:debug": "nest start --debug --watch",
    "start:prod": "node dist/main",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

### Step 1.10: Run Migration

```bash
cd apps/nest/auth-service
npx prisma migrate dev --name init
```

---

## Service 2: Trip Service

### Step 2.1: Scaffold Service

```bash
cd apps/nest
nest new trip-service --package-manager pnpm --skip-git
cd trip-service
```

### Step 2.2: Install Dependencies

```bash
pnpm add @nestjs/platform-fastify @nestjs/config @nestjs/microservices @nestjs/terminus
pnpm add ioredis nats prom-client
pnpm add @prisma/client @ain-rider/shared-types@workspace:* @ain-rider/nats-client@workspace:* @ain-rider/redis-client@workspace:*
pnpm add -D prisma
```

### Step 2.3: Initialize Prisma

```bash
npx prisma init
```

Create `apps/nest/trip-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Trip {
  id                  String    @id @default(uuid())
  riderId             String
  driverId            String?
  status              String    // REQUESTED, MATCHED, DRIVER_ARRIVING, IN_PROGRESS, COMPLETED, CANCELLED
  pickupLatitude      Float
  pickupLongitude     Float
  dropoffLatitude     Float
  dropoffLongitude    Float
  pickupAddress       String
  dropoffAddress      String
  estimatedFare       Float
  actualFare          Float?
  paymentMethod       String
  distance            Int?      // meters
  duration            Int?      // seconds
  requestedAt         DateTime  @default(now())
  matchedAt           DateTime?
  startedAt           DateTime?
  completedAt         DateTime?
  cancelledAt         DateTime?
  cancellationReason  String?
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt

  @@map("trips")
}
```

### Step 2.4: Implement Trip Service

Create `apps/nest/trip-service/src/trips/trips.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import { NATS_SUBJECTS, TripStatus } from '@ain-rider/shared-types';

@Injectable()
export class TripsService {
  private natsPublisher: any;

  constructor(private prisma: PrismaService) {
    this.initNats();
  }

  private async initNats() {
    const nc = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'trip-service',
    });
    this.natsPublisher = createPublisher(nc);
  }

  async createTrip(data: {
    riderId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    dropoffLatitude: number;
    dropoffLongitude: number;
    pickupAddress: string;
    dropoffAddress: string;
    paymentMethod: string;
    estimatedFare: number;
  }) {
    const trip = await this.prisma.trip.create({
      data: {
        ...data,
        status: TripStatus.REQUESTED,
      },
    });

    // Publish trip requested event
    if (this.natsPublisher) {
      await this.natsPublisher.publish({
        subject: NATS_SUBJECTS.TRIP_REQUESTED,
        data: {
          tripId: trip.id,
          riderId: trip.riderId,
          pickupLocation: {
            latitude: trip.pickupLatitude,
            longitude: trip.pickupLongitude,
            timestamp: new Date(),
          },
          dropoffLocation: {
            latitude: trip.dropoffLatitude,
            longitude: trip.dropoffLongitude,
            timestamp: new Date(),
          },
        },
      });
    }

    return trip;
  }

  async updateTripStatus(tripId: string, status: TripStatus, driverId?: string) {
    const updateData: any = { status };

    if (status === TripStatus.MATCHED && driverId) {
      updateData.driverId = driverId;
      updateData.matchedAt = new Date();
    } else if (status === TripStatus.IN_PROGRESS) {
      updateData.startedAt = new Date();
    } else if (status === TripStatus.COMPLETED) {
      updateData.completedAt = new Date();
    } else if (status === TripStatus.CANCELLED) {
      updateData.cancelledAt = new Date();
    }

    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Publish status change event
    if (this.natsPublisher) {
      const subject =
        status === TripStatus.IN_PROGRESS
          ? NATS_SUBJECTS.TRIP_STARTED
          : status === TripStatus.COMPLETED
          ? NATS_SUBJECTS.TRIP_COMPLETED
          : status === TripStatus.CANCELLED
          ? NATS_SUBJECTS.TRIP_CANCELLED
          : null;

      if (subject) {
        await this.natsPublisher.publish({
          subject,
          data: {
            tripId: trip.id,
            status: trip.status,
            timestamp: new Date(),
          },
        });
      }
    }

    return trip;
  }

  async getTripById(tripId: string) {
    return this.prisma.trip.findUnique({ where: { id: tripId } });
  }

  async getTripsByRider(riderId: string) {
    return this.prisma.trip.findMany({
      where: { riderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getTripsByDriver(driverId: string) {
    return this.prisma.trip.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
```

Create `apps/nest/trip-service/src/trips/trips.controller.ts`:

```typescript
import { Controller, Post, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { TripsService } from './trips.service';

@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Post()
  async createTrip(@Body() body: any) {
    return this.tripsService.createTrip(body);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string; driverId?: string },
  ) {
    return this.tripsService.updateTripStatus(id, body.status as any, body.driverId);
  }

  @Get(':id')
  async getTrip(@Param('id') id: string) {
    return this.tripsService.getTripById(id);
  }

  @Get()
  async getTrips(@Query('riderId') riderId?: string, @Query('driverId') driverId?: string) {
    if (riderId) {
      return this.tripsService.getTripsByRider(riderId);
    }
    if (driverId) {
      return this.tripsService.getTripsByDriver(driverId);
    }
    return [];
  }
}
```

Follow similar patterns as auth-service for PrismaModule, HealthController, and main.ts.

---

## Service 3: Payment Service

### Step 3.1: Scaffold Service

```bash
cd apps/nest
nest new payment-service --package-manager pnpm --skip-git
cd payment-service
```

### Step 3.2: Create Prisma Schema

Create `apps/nest/payment-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Payment {
  id            String    @id @default(uuid())
  tripId        String    @unique
  riderId       String
  driverId      String
  amount        Float
  currency      String    @default("USD")
  status        String    // PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
  paymentMethod String
  transactionId String?
  createdAt     DateTime  @default(now())
  completedAt   DateTime?
  updatedAt     DateTime  @updatedAt

  @@map("payments")
}
```

### Step 3.3: Implement Payment Service

Create `apps/nest/payment-service/src/payments/payments.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import { NATS_SUBJECTS, PaymentStatus } from '@ain-rider/shared-types';

@Injectable()
export class PaymentsService {
  private natsPublisher: any;

  constructor(private prisma: PrismaService) {
    this.initNats();
  }

  private async initNats() {
    const nc = await createNatsConnection({
      url: process.env.NATS_URL || 'nats://localhost:4222',
      name: 'payment-service',
    });
    this.natsPublisher = createPublisher(nc);
  }

  async createPayment(data: {
    tripId: string;
    riderId: string;
    driverId: string;
    amount: number;
    paymentMethod: string;
  }) {
    const payment = await this.prisma.payment.create({
      data: {
        ...data,
        currency: 'USD',
        status: PaymentStatus.PENDING,
      },
    });

    // Simulate payment processing
    setTimeout(() => this.processPayment(payment.id), 2000);

    return payment;
  }

  private async processPayment(paymentId: string) {
    // Simulate payment gateway call
    const success = Math.random() > 0.1; // 90% success rate

    const payment = await this.prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: success ? PaymentStatus.COMPLETED : PaymentStatus.FAILED,
        completedAt: success ? new Date() : null,
        transactionId: success ? `txn_${Date.now()}` : null,
      },
    });

    // Publish payment processed event
    if (this.natsPublisher && success) {
      await this.natsPublisher.publish({
        subject: NATS_SUBJECTS.PAYMENT_PROCESSED,
        data: {
          tripId: payment.tripId,
          paymentId: payment.id,
          amount: payment.amount,
          status: payment.status,
        },
      });
    }

    return payment;
  }

  async getPaymentByTrip(tripId: string) {
    return this.prisma.payment.findUnique({ where: { tripId } });
  }
}
```

Follow similar patterns for controller, module, and configuration.

---

## Service 4: Admin Service

### Step 4.1: Scaffold Service

```bash
cd apps/nest
nest new admin-service --package-manager pnpm --skip-git
cd admin-service
```

### Step 4.2: Implement Analytics

Create `apps/nest/admin-service/src/analytics/analytics.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { createRedisCluster, createCache } from '@ain-rider/redis-client';

@Injectable()
export class AnalyticsService {
  private cache: any;

  constructor() {
    const cluster = createRedisCluster({
      nodes: (process.env.REDIS_NODES || 'localhost:6379').split(','),
    });
    this.cache = createCache(cluster);
  }

  async getDashboardStats() {
    // Aggregate stats from cache
    const activeDrivers = await this.cache.get('stats:active_drivers') || 0;
    const activeTrips = await this.cache.get('stats:active_trips') || 0;
    const totalRevenue = await this.cache.get('stats:total_revenue') || 0;

    return {
      activeDrivers,
      activeTrips,
      totalRevenue,
      timestamp: new Date(),
    };
  }
}
```

---

## Build All Services

```bash
cd backend
pnpm --filter './apps/nest/**' install
pnpm --filter './apps/nest/**' run prisma:generate
pnpm --filter './apps/nest/**' build
```

---

## Verification Steps

```bash
# Start each service
cd apps/nest/auth-service && pnpm start:dev
cd apps/nest/trip-service && pnpm start:dev
cd apps/nest/payment-service && pnpm start:dev
cd apps/nest/admin-service && pnpm start:dev

# Test health endpoints
curl http://localhost:4000/health
curl http://localhost:4001/health
curl http://localhost:4002/health
curl http://localhost:4003/health
```

---

## Next Steps

✅ Phase 4 Complete!

Proceed to **Phase 5**: `PHASE_5_DOCKER_INFRASTRUCTURE.md`
