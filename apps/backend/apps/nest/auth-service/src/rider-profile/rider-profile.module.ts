import { Module } from "@nestjs/common";
import { RiderProfileService } from "./rider-profile.service";
import { RiderProfileController } from "./rider-profile.controller";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../shared/storage/storage.module";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [RiderProfileController],
  providers: [RiderProfileService],
  exports: [RiderProfileService],
})
export class RiderProfileModule {}
