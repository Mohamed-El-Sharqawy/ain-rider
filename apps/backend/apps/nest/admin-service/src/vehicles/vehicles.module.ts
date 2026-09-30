import { Module } from '@nestjs/common';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { VehicleCatalogController } from './vehicle-catalog.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [VehiclesController, VehicleCatalogController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
