// ─── Trips Controller ────────────────────────────────────────────────────────
// Admin endpoints for viewing and managing trips.

import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiBearerAuth } from '@nestjs/swagger';
import { AdminGuard } from '../auth/admin.guard';
import { TripsService } from './trips.service';
import { TripFiltersDto } from './dto/trip-filters.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';

@ApiTags('Admin - Trips')
@ApiBearerAuth()
@UseGuards(AdminGuard)
@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all trips with filters and pagination' })
  findAll(@Query() filters: TripFiltersDto) {
    return this.tripsService.findAll(filters);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get trip statistics' })
  getStats() {
    return this.tripsService.getStats();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancel a trip' })
  @ApiParam({ name: 'id', type: String })
  cancelTrip(@Param('id') id: string, @Body() body: CancelTripDto) {
    return this.tripsService.cancelTrip(id, body);
  }
}
