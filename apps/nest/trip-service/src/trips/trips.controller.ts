import { Controller, Post, Get, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { RateTripDto } from './dto/rate-trip.dto';

@ApiTags('Trips')
@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new trip request' })
  create(@Body() body: CreateTripDto) {
    return this.tripsService.createTrip(body);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update trip status' })
  @ApiParam({ name: 'id', type: String })
  updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateTripStatusDto,
  ) {
    return this.tripsService.updateStatus(id, body.status, body.driverId);
  }

  @Patch(':id/rate')
  @ApiOperation({ summary: 'Rate a trip' })
  @ApiParam({ name: 'id', type: String })
  rate(
    @Param('id') id: string,
    @Body() body: RateTripDto,
  ) {
    return this.tripsService.rateTrip(id, body.ratedBy, body.rating);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get trip by ID' })
  @ApiParam({ name: 'id', type: String })
  findOne(@Param('id') id: string) {
    return this.tripsService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get trips by rider or driver' })
  @ApiQuery({ name: 'riderId', required: false, type: String })
  @ApiQuery({ name: 'driverId', required: false, type: String })
  findMany(
    @Query('riderId') riderId?: string,
    @Query('driverId') driverId?: string,
  ) {
    if (riderId) return this.tripsService.findByRider(riderId);
    if (driverId) return this.tripsService.findByDriver(driverId);
    return [];
  }
}
