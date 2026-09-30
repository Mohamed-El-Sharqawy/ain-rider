import { Controller, Get, Query, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { TripsService } from './trips.service';
import { InternalAuthGuard } from '../shared/guards/internal-auth.guard';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TripStatus } from '@ain-rider/shared-types';

@ApiTags('admin')
@Controller('trips/admin')
@UseGuards(InternalAuthGuard)
@ApiBearerAuth('internal-secret')
export class AdminController {
  constructor(private readonly tripsService: TripsService) {}

  @Get('trips')
  @ApiOperation({ summary: 'List trips (Admin only)' })
  async listTrips(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('status') status?: TripStatus,
    @Query('search') search?: string,
  ) {
    return this.tripsService.findAllTrips({
      skip: skip ? parseInt(skip) : undefined,
      take: take ? parseInt(take) : undefined,
      status,
      search,
    });
  }

  @Get('trips/stats')
  @ApiOperation({ summary: 'Get trip stats (Admin only)' })
  async getStats() {
    return this.tripsService.getTripStats();
  }

  @Get('trips/:id')
  @ApiOperation({ summary: 'Get trip details by ID (Admin only)' })
  async getTrip(@Param('id') id: string) {
    const trip = await this.tripsService.findById(id);
    if (!trip) {
      throw new NotFoundException('Trip not found');
    }
    return trip;
  }
}
