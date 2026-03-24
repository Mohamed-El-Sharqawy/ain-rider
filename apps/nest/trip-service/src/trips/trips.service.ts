import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { TripEventPublisher } from '../events/trip-event.publisher';
import { TripStatus } from '@ain-rider/shared-types';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class TripsService {
  private eventPublisher: TripEventPublisher;

  constructor(
    private prisma: PrismaService,
    private nats: NatsService,
  ) {
    this.eventPublisher = new TripEventPublisher();
  }

  /**
   * Initialize event publisher with NATS connection
   * Called by module on init
   */
  initEventPublisher(): void {
    this.eventPublisher.init(this.nats.nc);
  }

  async createTrip(data: CreateTripDto, traceId?: string) {
    const trip = await this.prisma.trip.create({
      data: {
        ...data,
        paymentMethod: data.paymentMethod ?? 'CASH',
        paymentStatus: 'PENDING',
        status: TripStatus.REQUESTED,
      },
    });

    // Publish trip_requested event via JetStream
    await this.eventPublisher.publishTripRequested(trip, traceId);

    return trip;
  }

  async updateStatus(tripId: string, status: TripStatus, driverId?: string, traceId?: string) {
    const data: Prisma.TripUpdateInput = { status };
    if (status === TripStatus.MATCHED && driverId) {
      data.driverId = driverId;
      data.matchedAt = new Date();
    } else if (status === TripStatus.IN_PROGRESS) {
      data.startedAt = new Date();
    } else if (status === TripStatus.COMPLETED) {
      data.completedAt = new Date();
    } else if (status === TripStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }

    const trip = await this.prisma.trip.update({ where: { id: tripId }, data });

    // Publish appropriate event based on status
    if (status === TripStatus.IN_PROGRESS) {
      await this.eventPublisher.publishTripStarted(trip, traceId);
    } else if (status === TripStatus.COMPLETED) {
      await this.eventPublisher.publishTripCompleted(trip, traceId);
    }

    return trip;
  }

  findById(id: string) {
    return this.prisma.trip.findUnique({ where: { id } });
  }

  findByRider(riderId: string) {
    return this.prisma.trip.findMany({
      where: { riderId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  findByDriver(driverId: string) {
    return this.prisma.trip.findMany({
      where: { driverId },
      orderBy: { requestedAt: 'desc' },
    });
  }

  rateTrip(tripId: string, ratedBy: 'rider' | 'driver', rating: number) {
    return this.prisma.trip.update({
      where: { id: tripId },
      data: ratedBy === 'rider' ? { driverRating: rating } : { riderRating: rating },
    });
  }

  async cancelTrip(tripId: string, reason: string, cancelledBy: string, traceId?: string) {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: cancelledBy,
      },
    });

    // Publish trip_cancelled event via JetStream
    await this.eventPublisher.publishTripCancelled(
      trip,
      cancelledBy as 'RIDER' | 'DRIVER' | 'SYSTEM',
      reason,
      traceId
    );

    return trip;
  }
}
