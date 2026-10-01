import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NatsService } from '../shared/nats/nats.service';
import { TripEventPublisher } from '../events/trip-event.publisher';
import { TripStatus, haversineDistance } from '@ain-rider/shared-types';
import { fetchInternal } from '@ain-rider/internal-api';
import type { CreateTripDto } from './dto/create-trip.dto';
import type { Prisma } from '../generated/prisma/client';
import type { SOS } from '../generated/prisma/client';

type TripStatusType = typeof TripStatus[keyof typeof TripStatus];

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  [TripStatus.REQUESTED]: new Set([TripStatus.MATCHED, TripStatus.ASSIGNED, TripStatus.IN_PROGRESS, TripStatus.CANCELLED]),
  [TripStatus.ASSIGNED]: new Set([TripStatus.ASSIGNED, TripStatus.MATCHED, TripStatus.IN_PROGRESS, TripStatus.CANCELLED]),
  [TripStatus.MATCHED]: new Set([TripStatus.DRIVER_ARRIVING, TripStatus.IN_PROGRESS, TripStatus.CANCELLED]),
  [TripStatus.DRIVER_ARRIVING]: new Set([TripStatus.IN_PROGRESS, TripStatus.CANCELLED]),
  [TripStatus.IN_PROGRESS]: new Set([TripStatus.COMPLETED, TripStatus.CANCELLED]),
  [TripStatus.COMPLETED]: new Set(),
  [TripStatus.CANCELLED]: new Set(),
};

@Injectable()
export class TripsService {
  private eventPublisher: TripEventPublisher;

  constructor(
    private prisma: PrismaService,
    private nats: NatsService,
  ) {
    this.eventPublisher = new TripEventPublisher();
  }

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

    await this.eventPublisher.publishTripRequested(trip, traceId);

    return trip;
  }

  async updateStatus(
    tripId: string, 
    status: TripStatusType, 
    driverId?: string, 
    traceId?: string,
    metadata?: {
      driverName?: string;
      driverPhone?: string;
      driverRating?: number;
      vehicleMake?: string;
      vehicleModel?: string;
      vehiclePlate?: string;
    }
  ) {
    const existing = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!existing) {
      throw new BadRequestException(`Trip ${tripId} not found`);
    }

    // Idempotency check: if already in the target status, just return the trip
    if (existing.status === (status as any)) {
      return existing;
    }

    const allowed = VALID_TRANSITIONS[existing.status];
    if (!allowed || !allowed.has(status)) {
      throw new BadRequestException(`Invalid transition: ${existing.status} → ${status}`);
    }

    const data: Prisma.TripUpdateInput = { status: status as any };
    if (status === 'ASSIGNED' as any && driverId) {
      data.driverId = driverId;
      if (metadata) {
        data.driverName = metadata.driverName;
        data.driverPhone = metadata.driverPhone;
        data.driverRating = metadata.driverRating;
        data.vehicleMake = metadata.vehicleMake;
        data.vehicleModel = metadata.vehicleModel;
        data.vehiclePlate = metadata.vehiclePlate;
      }
    } else if (status === TripStatus.MATCHED) {
      // A trip is "matched" the moment it is claimed, driver or not — stamp
      // matchedAt on every MATCHED transition.
      data.matchedAt = new Date();
      if (driverId) {
        data.driverId = driverId;
        // Ensure metadata is saved if provided during final confirmation
        if (metadata) {
          data.driverName = metadata.driverName;
          data.driverPhone = metadata.driverPhone;
          // ... other fields if needed, but usually redundant
        }
      }
    } else if (status === TripStatus.IN_PROGRESS) {
      data.startedAt = new Date();
    } else if (status === TripStatus.COMPLETED) {
      data.completedAt = new Date();
    } else if (status === TripStatus.CANCELLED) {
      data.cancelledAt = new Date();
    }

    const trip = await this.prisma.trip.update({ where: { id: tripId }, data });

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
      where: { riderId, status: TripStatus.COMPLETED },
      orderBy: { requestedAt: 'desc' },
    });
  }

  findByDriver(driverId: string) {
    return this.prisma.trip.findMany({
      where: { driverId, status: TripStatus.COMPLETED },
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
    const existing = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!existing) {
      throw new Error(`Trip ${tripId} not found`);
    }

    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.CANCELLED,
        cancelledAt: new Date(),
        cancellationReason: reason,
        cancelledBy: cancelledBy,
      },
    });

    const driverId = trip.driverId ?? existing.driverId;

    await this.eventPublisher.publishTripCancelled(
      {
        ...trip,
        driverId,
      },
      cancelledBy as 'RIDER' | 'DRIVER' | 'SYSTEM',
      reason,
      traceId,
    );

    return trip;
  }

  async rejectTrip(tripId: string, driverId: string, reason?: string, traceId?: string) {
    const existing = await this.prisma.trip.findUnique({ where: { id: tripId } });

    if (!existing) {
      throw new Error(`Trip ${tripId} not found`);
    }

    if (existing.status !== TripStatus.REQUESTED && existing.status !== TripStatus.MATCHED) {
      throw new Error(`Cannot reject trip in status ${existing.status}`);
    }

    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        status: TripStatus.REQUESTED,
        driverId: null,
      },
    });

    await this.eventPublisher.publishTripRejected(
      {
        id: trip.id,
        driverId,
        riderId: trip.riderId,
        reason: reason || 'DRIVER_REJECTED',
      },
      traceId,
    );

    return trip;
  }

  async acceptTrip(tripId: string, driverId: string, traceId?: string) {
    const result = await this.prisma.trip.updateMany({
      where: {
        id: tripId,
        status: { in: [TripStatus.REQUESTED, 'ASSIGNED'] as any },
      },
      data: {
        status: TripStatus.MATCHED as any,
        matchedAt: new Date(),
        driverId,
      },
    });

    if (result.count === 0) {
      throw new BadRequestException(`Trip ${tripId} not available for acceptance (already matched/cancelled)`);
    }

    const updated = await this.prisma.trip.findUnique({ where: { id: tripId } });

    await this.eventPublisher.publishTripMatched(
      {
        tripId: updated!.id,
        driverId: updated!.driverId!,
        driverName: updated!.driverName || 'Driver',
        driverPhone: updated!.driverPhone || '',
        driverRating: updated!.driverRating || 5,
        vehicleMake: updated!.vehicleMake || '',
        vehicleModel: updated!.vehicleModel || '',
        vehiclePlate: updated!.vehiclePlate || '',
        estimatedArrival: 5,
        distance: updated!.distance || 0,
      },
      traceId,
    );

    return updated;
  }

  async assignDriver(tripId: string, driverId: string, _assignedBy: string, _traceId?: string) {
    const trip = await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        driverId,
        status: TripStatus.MATCHED,
        matchedAt: new Date(),
      },
    });

    return trip;
  }

  async triggerSOS(
    data: {
      tripId?: string;
      userId: string;
      userType: 'RIDER' | 'DRIVER';
      lat: number;
      lng: number;
      reason?: string;
    },
    traceId?: string,
  ): Promise<SOS> {
    const sos = await this.prisma.sOS.create({
      data: {
        tripId: data.tripId,
        userId: data.userId,
        userType: data.userType,
        latitude: data.lat,
        longitude: data.lng,
        reason: data.reason,
        status: 'ACTIVE',
      },
    });

    await this.eventPublisher.publishSOSCreated(
      {
        sosId: sos.id,
        tripId: sos.tripId,
        userId: sos.userId,
        userType: sos.userType as 'RIDER' | 'DRIVER',
        location: { lat: sos.latitude, lng: sos.longitude },
        reason: sos.reason,
      },
      traceId,
    );

    return sos;
  }

  async resolveSOS(
    sosId: string,
    resolvedBy: string,
    resolution: 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES',
    notes?: string,
    traceId?: string,
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

    await this.eventPublisher.publishSOSResolved(
      {
        sosId: sos.id,
        resolvedBy: sos.resolvedBy!,
        resolution: sos.resolution as 'FALSE_ALARM' | 'RESOLVED' | 'ESCALATED_TO_AUTHORITIES',
        notes,
      },
      traceId,
    );

    return sos;
  }

  async findAllTrips(params: { skip?: number; take?: number; status?: TripStatusType; search?: string }) {
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

    return { trips, total };
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

    return { total, requested, matched, inProgress, completed, cancelled };
  }

  async estimateFare(
    pickupLat: number,
    pickupLng: number,
    dropoffLat: number,
    dropoffLng: number,
  ) {
    let distanceMeters: number;
    let durationSeconds: number;
    let routeSource: 'osrm' | 'haversine' = 'osrm';

    try {
      const OSRM_URL = process.env.OSRM_URL;
      if (!OSRM_URL) {
        throw new Error('[TripsService] FATAL: OSRM_URL environment variable is required for fare estimation');
      }
      const res = await fetchInternal(
        `${OSRM_URL}/route/v1/driving/${pickupLng},${pickupLat};${dropoffLng},${dropoffLat}?overview=false`,
        'GET',
        undefined,
        { targetService: 'osrm' }
      );
      
      if (!res.ok) {
        throw new Error(`OSRM fetch failed: ${res.status}`);
      }
      
      const data = await res.json() as any;

      if (data.routes && data.routes.length > 0) {
        distanceMeters = data.routes[0].distance;
        durationSeconds = data.routes[0].duration;
      } else {
        throw new Error('No route found');
      }
    } catch {
      routeSource = 'haversine';
      distanceMeters = haversineDistance(
        { latitude: pickupLat, longitude: pickupLng },
        { latitude: dropoffLat, longitude: dropoffLng },
      ) * 1.3;
      durationSeconds = (distanceMeters / 1000 / 30) * 3600;
    }

    const distanceKm = distanceMeters / 1000;
    const durationMin = durationSeconds / 60;

    let baseFare = 2500;
    let perKmRate = 1000;
    let perMinRate = 200;
    let minimumFare = 5000;

    try {
      const ADMIN_URL = process.env.ADMIN_SERVICE_URL || 'http://localhost:4004';
      const settingsRes = await fetchInternal(`${ADMIN_URL}/settings/public/fare_config`, 'GET');
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json() as any;
        const raw = settingsData?.data?.value || settingsData?.value;
        if (raw) {
          const config = typeof raw === 'string' ? JSON.parse(raw) : raw;
          // Explicit zeros are valid config (e.g. promo rates) — only skip
          // fields that are absent.
          if (config.baseFare != null) baseFare = Number(config.baseFare);
          if (config.perKmRate != null) perKmRate = Number(config.perKmRate);
          if (config.perMinRate != null) perMinRate = Number(config.perMinRate);
          if (config.minimumFare != null) minimumFare = Number(config.minimumFare);
        }
      }
    } catch {}

    const distanceFare = distanceKm * perKmRate;
    const timeFare = durationMin * perMinRate;
    const calculated = baseFare + distanceFare + timeFare;
    const estimatedFare = Math.max(calculated, minimumFare);

    return {
      estimatedFare: Math.round(estimatedFare),
      distance: Math.round(distanceMeters),
      duration: Math.round(durationSeconds),
      currency: 'EGP',
      routeSource,
      breakdown: {
        baseFare,
        distanceFare: Math.round(distanceFare),
        timeFare: Math.round(timeFare),
      },
    };
  }
}
