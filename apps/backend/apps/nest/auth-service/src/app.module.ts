import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TerminusModule } from "@nestjs/terminus";
import { MetricsModule } from "@ain-rider/metrics";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { StorageModule } from "./shared/storage/storage.module";
import { DriverOnboardingModule } from "./driver-onboarding/driver-onboarding.module";
import { RiderProfileModule } from "./rider-profile/rider-profile.module";
import { HealthController } from "./health/health.controller";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MetricsModule.forRoot({ serviceName: "auth-service" }),
    TerminusModule,
    PrismaModule,
    AuthModule,
    StorageModule,
    DriverOnboardingModule,
    RiderProfileModule,
  ],
  controllers: [HealthController],
})
export class AppModule { }
