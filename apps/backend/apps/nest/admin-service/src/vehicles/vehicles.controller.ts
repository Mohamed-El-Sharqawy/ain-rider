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
import { CreateVehicleMakeDto, UpdateVehicleMakeDto } from './dto/vehicle-make.dto';
import { CreateVehicleModelDto, UpdateVehicleModelDto } from './dto/vehicle-model.dto';

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

  // --- Makes ---
  @Get('vehicle-makes')
  @ApiOperation({ summary: 'Get all vehicle makes' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAllMakes(@Query('activeOnly') activeOnly?: boolean) {
    return this.vehiclesService.findAllMakes(activeOnly);
  }

  @Roles('ADMIN')
  @Post('vehicle-makes')
  @ApiOperation({ summary: 'Create a vehicle make' })
  createMake(@Body() body: CreateVehicleMakeDto) {
    return this.vehiclesService.createMake(body);
  }

  @Roles('ADMIN')
  @Patch('vehicle-makes/:id')
  @ApiOperation({ summary: 'Update a vehicle make' })
  updateMake(@Param('id') id: string, @Body() body: UpdateVehicleMakeDto) {
    return this.vehiclesService.updateMake(id, body);
  }

  // --- Models ---
  @Get('vehicle-models')
  @ApiOperation({ summary: 'Get all vehicle models' })
  @ApiQuery({ name: 'makeId', required: false, type: String })
  findAllModels(@Query('makeId') makeId?: string) {
    return this.vehiclesService.findAllModels(makeId);
  }

  @Roles('ADMIN')
  @Post('vehicle-models')
  @ApiOperation({ summary: 'Create a vehicle model' })
  createModel(@Body() body: CreateVehicleModelDto) {
    return this.vehiclesService.createModel(body);
  }

  @Roles('ADMIN')
  @Patch('vehicle-models/:id')
  @ApiOperation({ summary: 'Update a vehicle model' })
  updateModel(@Param('id') id: string, @Body() body: UpdateVehicleModelDto) {
    return this.vehiclesService.updateModel(id, body);
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
