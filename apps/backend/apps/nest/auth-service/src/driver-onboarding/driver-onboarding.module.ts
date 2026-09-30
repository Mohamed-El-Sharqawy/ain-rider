import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { DriverOnboardingService } from "./driver-onboarding.service";
import { DriverOnboardingController } from "./driver-onboarding.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../shared/storage/storage.module";

@Module({
  imports: [PrismaModule, StorageModule, JwtModule],
  controllers: [DriverOnboardingController],
  providers: [DriverOnboardingService],
  exports: [DriverOnboardingService],
})
export class DriverOnboardingModule {}
