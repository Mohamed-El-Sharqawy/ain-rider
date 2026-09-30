import { Controller, Post, Get, Patch, Param, Body, Query, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiHeader } from '@nestjs/swagger';
import { TripsService } from './trips.service';
import { CreateTripDto } from './dto/create-trip.dto';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto';
import { RateTripDto } from './dto/rate-trip.dto';
import { EstimateFareDto } from './dto/estimate-fare.dto';
import { CancelTripDto } from './dto/cancel-trip.dto';
import { RejectTripDto } from './dto/reject-trip.dto';

@ApiTags('Trips')
@Controller('trips')
export class TripsController {
  constructor(private tripsService: TripsService) {}

  @Post('estimate')
  @ApiOperation({ summary: 'Estimate fare for a trip' })
  estimateFare(@Body() body: EstimateFareDto) {
    return this.tripsService.estimateFare(
      body.pickupLat,
      body.pickupLng,
      body.dropoffLat,
      body.dropoffLng,
    );
  }

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

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel trip' })
  @ApiParam({ name: 'id', type: String })
  cancel(
    @Param('id') id: string,
    @Body() body: CancelTripDto,
  ) {
    return this.tripsService.cancelTrip(id, body.reason, body.cancelledBy, body.traceId);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept trip (Driver only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the driver accepting the trip (injected by gateway)' })
  accept(
    @Param('id') id: string,
    @Headers('x-user-id') driverId: string,
  ) {
    return this.tripsService.acceptTrip(id, driverId);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: 'Reject trip (Driver only)' })
  @ApiParam({ name: 'id', type: String })
  @ApiHeader({ name: 'x-user-id', description: 'ID of the driver rejecting the trip (injected by gateway)' })
  reject(
    @Param('id') id: string,
    @Body() body: RejectTripDto,
    @Headers('x-user-id') driverId: string,
  ) {
    return this.tripsService.rejectTrip(id, driverId, body.reason, body.traceId);
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
