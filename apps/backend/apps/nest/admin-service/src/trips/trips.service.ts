import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminNatsClient } from '../nats/admin-nats.client';
import type { TripFiltersDto } from './dto/trip-filters.dto';
import type { CancelTripDto } from './dto/cancel-trip.dto';
import { InternalApiClient } from '../shared/internal-api/internal-api.client';
import { AdminAuditLogger } from '../shared/audit/admin-audit-logger.service';

@Injectable()
export class TripsService {
  private readonly tripUrl: string;

  constructor(
    private configService: ConfigService,
    private internalApi: InternalApiClient,
    private adminNats: AdminNatsClient,
    private auditLogger: AdminAuditLogger,
  ) {
    this.tripUrl = this.configService.get<string>('TRIP_SERVICE_URL') || 'http://localhost:4001';
  }

  async findAll(filters: TripFiltersDto) {
    const skip = filters.page && filters.limit ? (filters.page - 1) * filters.limit : 0;
    const take = filters.limit || 20;

    const queryParams = new URLSearchParams();
    queryParams.append('skip', skip.toString());
    queryParams.append('take', take.toString());
    if (filters.status) queryParams.append('status', filters.status);
    if (filters.search) queryParams.append('search', filters.search);

    return this.internalApi.fetchInternal(`${this.tripUrl}/trips/admin/trips?${queryParams.toString()}`);
  }

  async findById(id: string) {
    return this.internalApi.fetchInternal(`${this.tripUrl}/trips/admin/trips/${id}`);
  }

  async getStats() {
    return this.internalApi.fetchInternal(`${this.tripUrl}/trips/admin/trips/stats`);
  }

  async cancelTrip(id: string, data: CancelTripDto) {
    // 1. Get previous state for audit log
    const previousTrip = await this.findById(id);

    // 2. Publish NATS command
    const result = await this.adminNats.cancelTrip(id, data.reason, data.cancelledBy);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId: data.cancelledBy,
      action: 'TRIP_CANCEL',
      targetType: 'TRIP',
      targetId: id,
      previousState: previousTrip,
      newState: { ...(previousTrip as any), status: 'CANCELLED' },
      reason: data.reason,
    });

    return result;
  }

  async assignDriver(tripId: string, driverId: string, assignedBy: string) {
    // 1. Get previous state for audit log
    const previousTrip = await this.findById(tripId);

    // 2. Publish NATS command
    const result = await this.adminNats.assignDriver(tripId, driverId, assignedBy);

    // 3. Log to local audit
    await this.auditLogger.log({
      adminId: assignedBy,
      action: 'TRIP_ASSIGN_DRIVER',
      targetType: 'TRIP',
      targetId: tripId,
      previousState: previousTrip,
      newState: { ...(previousTrip as any), driverId, status: 'MATCHED' },
    });

    return result;
  }
}
