import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { TripEventPublisher } from '../events/trip-event.publisher';
import { TripStatus } from '@ain-rider/shared-types';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { Prisma } from '../generated/prisma/client';
import type { SOS } from '../generated/prisma/client';

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

  async assignDriver(tripId: string, driverId: string, assignedBy: string, _traceId?: string) {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        driverId,
        status: TripStatus.MATCHED,
        matchedAt: new Date(),
      },
    });

    console.log(
      `[TripsService] Driver assigned | tripId=${tripId} | driverId=${driverId} | assignedBy=${assignedBy}`
    );

    return trip;
  }

  /**
   * Trigger SOS emergency alert
   */
  async triggerSOS(
    data: {
      tripId?: string;
      userId: string;
      userType: 'RIDER' | 'DRIVER';
      lat: number;
      lng: number;
      reason?: string;
    },
    traceId?: string
  ): Promise<SOS> {
    const sos = await this.prisma.sOS.create({
      data: {
        tripId: data.tripId,
        userId: data.userId,
        userType: data.userType,
        lat: data.lat,
        lng: data.lng,
        reason: data.reason,
        status: 'ACTIVE',
      },
    });

    // Publish sos_created event
    await this.eventPublisher.publishSOSCreated(
      {
        sosId: sos.id,
        tripId: sos.tripId,
        userId: sos.userId,
        userType: sos.userType as 'RIDER' | 'DRIVER',
        location: { lat: sos.lat, lng: sos.lng },
        reason: sos.reason,
      },
      traceId
    );

    console.log(
      `[TripsService] SOS triggered | sosId=${sos.id} | userId=${data.userId} | traceId=${traceId}`
    );

    return sos;
  }

  /**
   * Resolve SOS emergency
   */
  async resolveSOS(
    sosId: string,
    resolvedBy: string,
    resolution: 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES',
    notes?: string,
    traceId?: string
  ): Promise<SOS> {
    const sos = await this.prisma.sOS.update({
      where: { id: sosId },
      data: {
        status: 'RESOLVED',
        resolvedBy,
        resolution,
        resolvedAt: new Date(),
      },
    });

    // Publish sos_resolved event
    await this.eventPublisher.publishSOSResolved(
      {
        sosId: sos.id,
        resolvedBy: sos.resolvedBy!,
        resolution: sos.resolution as 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES',
        notes,
      },
      traceId
    );

    console.log(
      `[TripsService] SOS resolved | sosId=${sosId} | resolvedBy=${resolvedBy} | traceId=${traceId}`
    );

    return sos;
  }

  async findAllTrips(params: { skip?: number; take?: number; status?: TripStatus; search?: string }) {
    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.search) {
      where.OR = [
        { id: { contains: params.search, mode: 'insensitive' } },
        { riderId: { contains: params.search, mode: 'insensitive' } },
        { driverId: { contains: params.search, mode: 'insensitive' } },
      ];
    }

    const [trips, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        skip: params.skip,
        take: params.take,
        orderBy: { requestedAt: 'desc' },
      }),
      this.prisma.trip.count({ where }),
    ]);

    return {
      trips,
      total,
    };
  }

  async getTripStats() {
    const [total, requested, matched, inProgress, completed, cancelled] = await Promise.all([
      this.prisma.trip.count(),
      this.prisma.trip.count({ where: { status: TripStatus.REQUESTED } }),
      this.prisma.trip.count({ where: { status: TripStatus.MATCHED } }),
      this.prisma.trip.count({ where: { status: TripStatus.IN_PROGRESS } }),
      this.prisma.trip.count({ where: { status: TripStatus.COMPLETED } }),
      this.prisma.trip.count({ where: { status: TripStatus.CANCELLED } }),
    ]);

    return {
      total,
      requested,
      matched,
      inProgress,
      completed,
      cancelled,
    };
  }
}
