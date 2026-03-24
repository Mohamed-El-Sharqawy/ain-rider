import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { AdminGuard } from '../auth/admin.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateVehicleTypeDto } from './dto/create-vehicle-type.dto';
import { UpdateVehicleTypeDto } from './dto/update-vehicle-type.dto';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

@ApiTags('Vehicles')
@ApiBearerAuth()
@UseGuards(AdminGuard, RolesGuard)
@Controller()
export class VehiclesController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get('vehicle-types')
  @ApiOperation({ summary: 'Get all vehicle types' })
  findAllTypes() {
    return this.vehiclesService.findAllTypes();
  }

  @Roles('ADMIN')
  @Post('vehicle-types')
  @ApiOperation({ summary: 'Create a vehicle type' })
  createType(@Body() body: CreateVehicleTypeDto) {
    return this.vehiclesService.createType(body);
  }

  @Roles('ADMIN')
  @Patch('vehicle-types/:id')
  @ApiOperation({ summary: 'Update a vehicle type' })
  @ApiParam({ name: 'id', type: String })
  updateType(@Param('id') id: string, @Body() body: UpdateVehicleTypeDto) {
    return this.vehiclesService.updateType(id, body);
  }

  @Get('vehicles')
  @ApiOperation({ summary: 'Get all vehicles' })
  @ApiQuery({ name: 'driverId', required: false, type: String })
  findAllVehicles(@Query('driverId') driverId?: string) {
    return this.vehiclesService.findAllVehicles(driverId);
  }

  @Post('vehicles')
  @ApiOperation({ summary: 'Create a vehicle' })
  createVehicle(@Body() body: CreateVehicleDto) {
    return this.vehiclesService.createVehicle(body);
  }

  @Patch('vehicles/:id')
  @ApiOperation({ summary: 'Update a vehicle' })
  @ApiParam({ name: 'id', type: String })
  updateVehicle(@Param('id') id: string, @Body() body: UpdateVehicleDto) {
    return this.vehiclesService.updateVehicle(id, body);
  }
}
