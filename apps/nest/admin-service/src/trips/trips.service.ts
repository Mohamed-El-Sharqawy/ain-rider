// ─── Trips Service ───────────────────────────────────────────────────────────
// Admin-facing trip management.
// READ  → Direct read-only connection to trip_db (instant, no sync)
// WRITE → NATS request to trip-service (trip-service is sole writer)

import { Injectable, NotFoundException } from '@nestjs/common';
import { TripDbService } from '../prisma/trip-db.service';
import { AdminNatsClient } from '../nats/admin-nats.client';
import type { TripFiltersDto } from './dto/trip-filters.dto';
import type { CancelTripDto } from './dto/cancel-trip.dto';

@Injectable()
export class TripsService {
  constructor(
    private tripDb: TripDbService,
    private adminNats: AdminNatsClient,
  ) {}

  // ───────────────────────────────────────────────────────────────────────────
  // READ operations — direct DB access (read-only)
  // ───────────────────────────────────────────────────────────────────────────

  async findAll(filters: TripFiltersDto) {
    return this.tripDb.findAll(filters);
  }

  async findById(id: string) {
    const trip = await this.tripDb.findById(id);
    if (!trip) {
      throw new NotFoundException(`Trip ${id} not found`);
    }
    return trip;
  }

  async getStats() {
    return this.tripDb.getStats();
  }

  // ───────────────────────────────────────────────────────────────────────────
  // WRITE operations — via NATS request to trip-service
  // Admin-service NEVER writes directly to trip_db
  // ───────────────────────────────────────────────────────────────────────────

  async cancelTrip(id: string, data: CancelTripDto) {
    const trip = await this.findById(id);

    if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
      throw new Error(`Cannot cancel trip with status ${trip.status}`);
    }

    // Send cancel command to trip-service via NATS request-reply
    const result = await this.adminNats.cancelTrip(id, data.reason, data.cancelledBy);

    return result;
  }

  async assignDriver(tripId: string, driverId: string, assignedBy: string) {
    const trip = await this.findById(tripId);

    if (trip.status !== 'REQUESTED') {
      throw new Error(`Cannot assign driver to trip with status ${trip.status}`);
    }

    const result = await this.adminNats.assignDriver(tripId, driverId, assignedBy);

    return result;
  }
}
