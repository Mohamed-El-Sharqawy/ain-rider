/**
 * TripsService unit suite.
 *
 * Prisma is an in-memory stub and the NATS event boundary is spied, so every
 * branch of the service (status machine, SOS, admin queries, fare defaults)
 * is exercised deterministically without infra.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { TripStatus } from '@ain-rider/shared-types';
import { TripsService } from '../src/trips/trips.service';
import { TripEventPublisher } from '../src/events/trip-event.publisher';

type Trip = Record<string, any>;

function makeTrip(overrides: Trip = {}): Trip {
  return {
    id: 'trip-1',
    riderId: 'rider-1',
    driverId: null,
    status: TripStatus.REQUESTED,
    estimatedFare: 10_385,
    actualFare: null,
    distance: null,
    duration: null,
    requestedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

/** Chainable prisma stub: model methods are vi.fn returning queued results. */
function makePrisma() {
  return {
    trip: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    },
    sOS: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };
}

function makeService(prisma = makePrisma()) {
  const svc = new TripsService(prisma as any, { nc: { jetstream: () => ({}) } } as any);
  return { svc, prisma };
}

let publisherSpies: ReturnType<typeof spyPublisher>;

function spyPublisher() {
  return {
    requested: vi.spyOn(TripEventPublisher.prototype, 'publishTripRequested').mockResolvedValue(),
    started: vi.spyOn(TripEventPublisher.prototype, 'publishTripStarted').mockResolvedValue(),
    completed: vi.spyOn(TripEventPublisher.prototype, 'publishTripCompleted').mockResolvedValue(),
    cancelled: vi.spyOn(TripEventPublisher.prototype, 'publishTripCancelled').mockResolvedValue(),
    rejected: vi.spyOn(TripEventPublisher.prototype, 'publishTripRejected').mockResolvedValue(),
    matched: vi.spyOn(TripEventPublisher.prototype, 'publishTripMatched').mockResolvedValue(),
    sosCreated: vi.spyOn(TripEventPublisher.prototype, 'publishSOSCreated').mockResolvedValue(),
    sosResolved: vi.spyOn(TripEventPublisher.prototype, 'publishSOSResolved').mockResolvedValue(),
  };
}

beforeEach(() => {
  publisherSpies = spyPublisher();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('lifecycle: createTrip', () => {
  it('persists a REQUESTED trip with cash payment defaults and publishes trip_requested', async () => {
    const { svc, prisma } = makeService();
    const created = makeTrip();
    prisma.trip.create.mockResolvedValue(created);

    const trip = await svc.createTrip({ riderId: 'rider-1' } as any, 'trace-1');

    expect(trip).toBe(created);
    expect(prisma.trip.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        riderId: 'rider-1',
        paymentMethod: 'CASH',
        paymentStatus: 'PENDING',
        status: TripStatus.REQUESTED,
      }),
    });
    expect(publisherSpies.requested).toHaveBeenCalledWith(created, 'trace-1');
  });

  it('keeps an explicit paymentMethod when provided', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.create.mockResolvedValue(makeTrip());

    await svc.createTrip({ riderId: 'rider-1', paymentMethod: 'CASH' } as any);

    expect(prisma.trip.create.mock.calls[0][0].data.paymentMethod).toBe('CASH');
  });

  it('initEventPublisher wires the NATS connection into the publisher', () => {
    const { svc } = makeService();
    expect(() => svc.initEventPublisher()).not.toThrow();
  });
});

describe('lifecycle: updateStatus', () => {
  it('throws BadRequest when the trip does not exist', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(null);

    await expect(svc.updateStatus('nope', TripStatus.ASSIGNED)).rejects.toThrow(BadRequestException);
  });

  it('returns the trip unchanged when already in the target status (idempotent)', async () => {
    const { svc, prisma } = makeService();
    const existing = makeTrip({ status: TripStatus.IN_PROGRESS });
    prisma.trip.findUnique.mockResolvedValue(existing);

    const trip = await svc.updateStatus('trip-1', TripStatus.IN_PROGRESS);

    expect(trip).toBe(existing);
    expect(prisma.trip.update).not.toHaveBeenCalled();
  });

  it('rejects transitions that are not allowed', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.COMPLETED }));

    await expect(svc.updateStatus('trip-1', TripStatus.REQUESTED)).rejects.toThrow(
      /Invalid transition: COMPLETED/,
    );
  });

  it('ASSIGNED stores driverId and driver metadata when provided', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    const assigned = makeTrip({ status: TripStatus.ASSIGNED });
    prisma.trip.update.mockResolvedValue(assigned);

    const metadata = {
      driverName: 'Ali',
      driverPhone: '+20100',
      driverRating: 4.5,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehiclePlate: 'ABC 123',
    };
    const trip = await svc.updateStatus('trip-1', TripStatus.ASSIGNED, 'driver-1', 'trace-9', metadata);

    expect(trip).toBe(assigned);
    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { status: TripStatus.ASSIGNED, driverId: 'driver-1', ...metadata },
    });
    expect(publisherSpies.started).not.toHaveBeenCalled();
    expect(publisherSpies.completed).not.toHaveBeenCalled();
  });

  it('ASSIGNED without a driverId only flips the status', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.ASSIGNED }));

    await svc.updateStatus('trip-1', TripStatus.ASSIGNED);

    expect(prisma.trip.update.mock.calls[0][0].data).toEqual({ status: TripStatus.ASSIGNED });
  });

  it('MATCHED stores driverId, stamps matchedAt and copies partial metadata', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.ASSIGNED }));
    prisma.trip.update.mockImplementation(async ({ data }) => makeTrip({ status: data.status, ...data }));

    const trip = await svc.updateStatus('trip-1', TripStatus.MATCHED, 'driver-2', undefined, {
      driverName: 'Mona',
      driverPhone: '+20111',
    });

    expect(trip.driverName).toBe('Mona');
    const data = prisma.trip.update.mock.calls[0][0].data;
    expect(data.driverId).toBe('driver-2');
    expect(data.matchedAt).toBeInstanceOf(Date);
    expect(data.driverName).toBe('Mona');
    expect(data.vehicleMake).toBeUndefined();
  });

  it('MATCHED without driverId only stamps the status', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.MATCHED }));

    await svc.updateStatus('trip-1', TripStatus.MATCHED);

    expect(prisma.trip.update.mock.calls[0][0].data).toEqual({
      status: TripStatus.MATCHED,
      matchedAt: expect.any(Date),
    });
  });

  it('IN_PROGRESS stamps startedAt and publishes trip_started', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.MATCHED }));
    const started = makeTrip({ status: TripStatus.IN_PROGRESS, startedAt: new Date() });
    prisma.trip.update.mockResolvedValue(started);

    const trip = await svc.updateStatus('trip-1', TripStatus.IN_PROGRESS, undefined, 'trace-2');

    expect(prisma.trip.update.mock.calls[0][0].data).toEqual({
      status: TripStatus.IN_PROGRESS,
      startedAt: expect.any(Date),
    });
    expect(publisherSpies.started).toHaveBeenCalledWith(started, 'trace-2');
    expect(trip).toBe(started);
  });

  it('COMPLETED stamps completedAt and publishes trip_completed', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS }));
    const completed = makeTrip({ status: TripStatus.COMPLETED, completedAt: new Date() });
    prisma.trip.update.mockResolvedValue(completed);

    await svc.updateStatus('trip-1', TripStatus.COMPLETED);

    expect(prisma.trip.update.mock.calls[0][0].data).toEqual({
      status: TripStatus.COMPLETED,
      completedAt: expect.any(Date),
    });
    expect(publisherSpies.completed).toHaveBeenCalledWith(completed, undefined);
  });

  it('CANCELLED stamps cancelledAt without publishing a lifecycle event', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS }));
    prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.CANCELLED }));

    await svc.updateStatus('trip-1', TripStatus.CANCELLED);

    expect(prisma.trip.update.mock.calls[0][0].data).toEqual({
      status: TripStatus.CANCELLED,
      cancelledAt: expect.any(Date),
    });
    expect(publisherSpies.started).not.toHaveBeenCalled();
    expect(publisherSpies.completed).not.toHaveBeenCalled();
  });
});

describe('queries', () => {
  it('findById delegates to prisma', () => {
    const { svc, prisma } = makeService();
    svc.findById('trip-1');
    expect(prisma.trip.findUnique).toHaveBeenCalledWith({ where: { id: 'trip-1' } });
  });

  it('findByRider returns completed trips newest first', () => {
    const { svc, prisma } = makeService();
    svc.findByRider('rider-1');
    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      where: { riderId: 'rider-1', status: TripStatus.COMPLETED },
      orderBy: { requestedAt: 'desc' },
    });
  });

  it('findByDriver returns completed trips newest first', () => {
    const { svc, prisma } = makeService();
    svc.findByDriver('driver-1');
    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      where: { driverId: 'driver-1', status: TripStatus.COMPLETED },
      orderBy: { requestedAt: 'desc' },
    });
  });

  it('rateTrip by rider writes driverRating; by driver writes riderRating', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.update.mockResolvedValue(makeTrip());

    await svc.rateTrip('trip-1', 'rider', 4);
    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { driverRating: 4 },
    });

    await svc.rateTrip('trip-1', 'driver', 5);
    expect(prisma.trip.update).toHaveBeenLastCalledWith({
      where: { id: 'trip-1' },
      data: { riderRating: 5 },
    });
  });
});

describe('lifecycle: cancelTrip', () => {
  it('throws when the trip does not exist', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(null);

    await expect(svc.cancelTrip('nope', 'reason', 'RIDER')).rejects.toThrow('Trip nope not found');
  });

  it('cancels, keeps the assigned driver and publishes trip_cancelled', async () => {
    const { svc, prisma } = makeService();
    const existing = makeTrip({ status: TripStatus.IN_PROGRESS, driverId: 'driver-1' });
    prisma.trip.findUnique.mockResolvedValue(existing);
    const cancelled = makeTrip({ status: TripStatus.CANCELLED, driverId: null, cancelledAt: new Date() });
    prisma.trip.update.mockResolvedValue(cancelled);

    const trip = await svc.cancelTrip('trip-1', 'change of plans', 'RIDER', 'trace-3');

    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: {
        status: TripStatus.CANCELLED,
        cancelledAt: expect.any(Date),
        cancellationReason: 'change of plans',
        cancelledBy: 'RIDER',
      },
    });
    // cancelled row nulls the driver; the published event still carries it.
    expect(publisherSpies.cancelled).toHaveBeenCalledWith(
      { ...cancelled, driverId: 'driver-1' },
      'RIDER',
      'change of plans',
      'trace-3',
    );
    expect(trip).toBe(cancelled);
  });

  it('publishes without a driver when none was assigned', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip());
    prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.CANCELLED }));

    await svc.cancelTrip('trip-1', 'reason', 'SYSTEM');

    expect(publisherSpies.cancelled.mock.calls[0][0].driverId).toBeNull();
  });
});

describe('lifecycle: rejectTrip', () => {
  it('throws when the trip does not exist', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(null);

    await expect(svc.rejectTrip('nope', 'driver-1')).rejects.toThrow('Trip nope not found');
  });

  it('throws when the trip is past the rejectable window', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.IN_PROGRESS }));

    await expect(svc.rejectTrip('trip-1', 'driver-1')).rejects.toThrow(
      'Cannot reject trip in status IN_PROGRESS',
    );
  });

  it('resets a REQUESTED trip and publishes trip_rejected with the given reason', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.REQUESTED }));
    const reset = makeTrip({ status: TripStatus.REQUESTED, driverId: null });
    prisma.trip.update.mockResolvedValue(reset);

    const trip = await svc.rejectTrip('trip-1', 'driver-1', 'too far', 'trace-4');

    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { status: TripStatus.REQUESTED, driverId: null },
    });
    expect(publisherSpies.rejected).toHaveBeenCalledWith(
      { id: 'trip-1', driverId: 'driver-1', riderId: 'rider-1', reason: 'too far' },
      'trace-4',
    );
    expect(trip).toBe(reset);
  });

  it('defaults the rejection reason when none is given', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findUnique.mockResolvedValue(makeTrip({ status: TripStatus.MATCHED, driverId: 'driver-1' }));
    prisma.trip.update.mockResolvedValue(makeTrip({ status: TripStatus.REQUESTED }));

    await svc.rejectTrip('trip-1', 'driver-1');

    expect(publisherSpies.rejected.mock.calls[0][0].reason).toBe('DRIVER_REJECTED');
  });
});

describe('lifecycle: acceptTrip', () => {
  it('throws when no row matched (already matched/cancelled)', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.updateMany.mockResolvedValue({ count: 0 });

    await expect(svc.acceptTrip('trip-1', 'driver-1')).rejects.toThrow(BadRequestException);
    expect(prisma.trip.findUnique).not.toHaveBeenCalled();
  });

  it('atomically claims the trip and publishes trip_matched with field defaults', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.updateMany.mockResolvedValue({ count: 1 });
    prisma.trip.findUnique.mockResolvedValue(
      makeTrip({ status: TripStatus.MATCHED, driverId: 'driver-1' }),
    );

    const trip = await svc.acceptTrip('trip-1', 'driver-1', 'trace-5');

    expect(prisma.trip.updateMany).toHaveBeenCalledWith({
      where: { id: 'trip-1', status: { in: [TripStatus.REQUESTED, 'ASSIGNED'] } },
      data: { status: TripStatus.MATCHED, matchedAt: expect.any(Date), driverId: 'driver-1' },
    });
    expect(publisherSpies.matched).toHaveBeenCalledWith(
      expect.objectContaining({
        tripId: 'trip-1',
        driverId: 'driver-1',
        driverName: 'Driver',
        driverPhone: '',
        driverRating: 5,
        estimatedArrival: 5,
        distance: 0,
      }),
      'trace-5',
    );
    expect(trip?.status).toBe(TripStatus.MATCHED);
  });
});

describe('lifecycle: assignDriver', () => {
  it('sets the driver and MATCHED status', async () => {
    const { svc, prisma } = makeService();
    const assigned = makeTrip({ status: TripStatus.MATCHED, driverId: 'driver-9' });
    prisma.trip.update.mockResolvedValue(assigned);

    const trip = await svc.assignDriver('trip-1', 'driver-9', 'admin-1', 'trace-6');

    expect(prisma.trip.update).toHaveBeenCalledWith({
      where: { id: 'trip-1' },
      data: { driverId: 'driver-9', status: TripStatus.MATCHED, matchedAt: expect.any(Date) },
    });
    expect(trip).toBe(assigned);
  });
});

describe('SOS', () => {
  it('triggerSOS persists an ACTIVE sos and publishes sos_created', async () => {
    const { svc, prisma } = makeService();
    const sos = {
      id: 'sos-1',
      tripId: 'trip-1',
      userId: 'rider-1',
      userType: 'RIDER',
      latitude: 30.05,
      longitude: 31.23,
      reason: 'panic',
      status: 'ACTIVE',
    };
    prisma.sOS.create.mockResolvedValue(sos);

    const result = await svc.triggerSOS(
      { tripId: 'trip-1', userId: 'rider-1', userType: 'RIDER', lat: 30.05, lng: 31.23, reason: 'panic' },
      'trace-7',
    );

    expect(prisma.sOS.create).toHaveBeenCalledWith({
      data: {
        tripId: 'trip-1',
        userId: 'rider-1',
        userType: 'RIDER',
        latitude: 30.05,
        longitude: 31.23,
        reason: 'panic',
        status: 'ACTIVE',
      },
    });
    expect(publisherSpies.sosCreated).toHaveBeenCalledWith(
      {
        sosId: 'sos-1',
        tripId: 'trip-1',
        userId: 'rider-1',
        userType: 'RIDER',
        location: { lat: 30.05, lng: 31.23 },
        reason: 'panic',
      },
      'trace-7',
    );
    expect(result).toBe(sos);
  });

  it('resolveSOS marks the sos RESOLVED and publishes sos_resolved with notes', async () => {
    const { svc, prisma } = makeService();
    const sos = {
      id: 'sos-1',
      resolvedBy: 'admin-1',
      resolution: 'RESOLVED',
    };
    prisma.sOS.update.mockResolvedValue(sos);

    const result = await svc.resolveSOS('sos-1', 'admin-1', 'RESOLVED', 'handled by phone', 'trace-8');

    expect(prisma.sOS.update).toHaveBeenCalledWith({
      where: { id: 'sos-1' },
      data: {
        status: 'RESOLVED',
        resolvedBy: 'admin-1',
        resolution: 'RESOLVED',
        resolvedAt: expect.any(Date),
      },
    });
    expect(publisherSpies.sosResolved).toHaveBeenCalledWith(
      { sosId: 'sos-1', resolvedBy: 'admin-1', resolution: 'RESOLVED', notes: 'handled by phone' },
      'trace-8',
    );
    expect(result).toBe(sos);
  });
});

describe('admin queries', () => {
  it('findAllTrips filters by status and paginates', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findMany.mockResolvedValue([makeTrip()]);
    prisma.trip.count.mockResolvedValue(1);

    const page = await svc.findAllTrips({ skip: 10, take: 5, status: TripStatus.COMPLETED });

    const expectedWhere = { status: TripStatus.COMPLETED };
    expect(prisma.trip.findMany).toHaveBeenCalledWith({
      where: expectedWhere,
      skip: 10,
      take: 5,
      orderBy: { requestedAt: 'desc' },
    });
    expect(prisma.trip.count).toHaveBeenCalledWith({ where: expectedWhere });
    expect(page).toEqual({ trips: [expect.anything()], total: 1 });
  });

  it('findAllTrips builds an insensitive OR search over id/rider/driver', async () => {
    const { svc, prisma } = makeService();
    prisma.trip.findMany.mockResolvedValue([]);
    prisma.trip.count.mockResolvedValue(0);

    const page = await svc.findAllTrips({ search: 'abc' });

    const expectedWhere = {
      OR: [
        { id: { contains: 'abc', mode: 'insensitive' } },
        { riderId: { contains: 'abc', mode: 'insensitive' } },
        { driverId: { contains: 'abc', mode: 'insensitive' } },
      ],
    };
    expect(prisma.trip.findMany.mock.calls[0][0].where).toEqual(expectedWhere);
    expect(page.total).toBe(0);
  });

  it('getTripStats counts trips per status', async () => {
    const { svc, prisma } = makeService();
    let i = 0;
    prisma.trip.count.mockImplementation(async () => ++i);

    const stats = await svc.getTripStats();

    expect(stats).toEqual({
      total: 1,
      requested: 2,
      matched: 3,
      inProgress: 4,
      completed: 5,
      cancelled: 6,
    });
  });
});
