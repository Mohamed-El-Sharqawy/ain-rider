import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { NATS_SUBJECTS, TripStatus, type NatsEvent } from '@ain-rider/shared-types';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { Prisma } from '../generated/prisma/client';

@Injectable()
export class TripsService {
  constructor(
    private prisma: PrismaService,
    private nats: NatsService,
  ) {}

  async createTrip(data: CreateTripDto) {
    const trip = await this.prisma.trip.create({
      data: {
        ...data,
        paymentMethod: data.paymentMethod ?? 'CASH', // Default to CASH
        paymentStatus: 'PENDING',
        status: TripStatus.REQUESTED,
      },
    });

    const requestedAt = trip.requestedAt;
    await this.nats.publisher.publish({
      subject: NATS_SUBJECTS.TRIP_REQUESTED,
      data: {
        tripId: trip.id,
        riderId: trip.riderId,
        pickupLocation: {
          latitude: trip.pickupLat,
          longitude: trip.pickupLng,
          timestamp: requestedAt,
        },
        dropoffLocation: {
          latitude: trip.dropoffLat,
          longitude: trip.dropoffLng,
          timestamp: requestedAt,
        },
        pickupAddress: trip.pickupAddress,
        dropoffAddress: trip.dropoffAddress,
        estimatedFare: trip.estimatedFare,
        paymentMethod: trip.paymentMethod,
        promoCode: trip.promoCode,
        requestedAt: requestedAt.toISOString(),
        status: trip.status,
        driverId: trip.driverId,
      },
    });

    return trip;
  }

  async updateStatus(tripId: string, status: TripStatus, driverId?: string) {
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

    const subjectMap: Partial<
      Record<
        TripStatus,
        | typeof NATS_SUBJECTS.TRIP_STARTED
        | typeof NATS_SUBJECTS.TRIP_COMPLETED
        | typeof NATS_SUBJECTS.TRIP_CANCELLED
        | typeof NATS_SUBJECTS.TRIP_MATCHED
      >
    > = {
      [TripStatus.MATCHED]: NATS_SUBJECTS.TRIP_MATCHED,
      [TripStatus.IN_PROGRESS]: NATS_SUBJECTS.TRIP_STARTED,
      [TripStatus.COMPLETED]: NATS_SUBJECTS.TRIP_COMPLETED,
      [TripStatus.CANCELLED]: NATS_SUBJECTS.TRIP_CANCELLED,
    };
    const subject = subjectMap[status];
    if (subject) {
      const now = new Date();
      const snapshot = {
        tripId: trip.id,
        status: trip.status,
        driverId: trip.driverId,
        actualFare: trip.actualFare,
        distance: trip.distance,
        duration: trip.duration,
        matchedAt: trip.matchedAt?.toISOString(),
        startedAt: trip.startedAt?.toISOString(),
        completedAt: trip.completedAt?.toISOString(),
        cancelledAt: trip.cancelledAt?.toISOString(),
        cancellationReason: trip.cancellationReason,
        cancelledBy: trip.cancelledBy,
        driverRating: trip.driverRating,
        riderRating: trip.riderRating,
        updatedAt: trip.updatedAt.toISOString(),
      };

      const event: NatsEvent =
        subject === NATS_SUBJECTS.TRIP_MATCHED
          ? { subject, data: snapshot }
          : { subject, data: { ...snapshot, timestamp: now } };

      await this.nats.publisher.publish(event);
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

  async cancelTrip(tripId: string, reason: string, cancelledBy: string) {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: cancelledBy,
      },
    });

    await this.nats.publisher.publish({
      subject: NATS_SUBJECTS.TRIP_CANCELLED,
      data: {
        tripId: trip.id,
        status: trip.status,
        timestamp: trip.cancelledAt ?? new Date(),
        cancelledAt: trip.cancelledAt?.toISOString(),
        cancellationReason: trip.cancellationReason,
        cancelledBy: trip.cancelledBy,
        updatedAt: trip.updatedAt.toISOString(),
      },
    });

    return trip;
  }
}
