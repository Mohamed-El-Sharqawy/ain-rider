import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { VehiclesService } from './vehicles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Vehicle Catalog')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('catalog')
export class VehicleCatalogController {
  constructor(private vehiclesService: VehiclesService) {}

  @Get('makes')
  @ApiOperation({ summary: 'Get all vehicle makes (Public Catalog)' })
  @ApiQuery({ name: 'activeOnly', required: false, type: Boolean })
  findAllMakes(@Query('activeOnly') activeOnly?: boolean) {
    return this.vehiclesService.findAllMakes(activeOnly !== false); // Default to activeOnly
  }

  @Get('models')
  @ApiOperation({ summary: 'Get vehicle models by make (Public Catalog)' })
  @ApiQuery({ name: 'makeId', required: false, type: String })
  findAllModels(@Query('makeId') makeId?: string) {
    return this.vehiclesService.findAllModels(makeId);
  }
}
