/**
 * TripEventPublisher unit suite.
 *
 * JetStreamPublisher is mocked at the module boundary; the suite pins the
 * envelope each lifecycle method hands to NATS (subject, event type, payload
 * field mapping and trace propagation).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const publishMock = vi.fn().mockResolvedValue({ seq: 1, duplicate: false });

vi.mock('@ain-rider/nats-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain-rider/nats-client')>();
  return {
    ...actual,
    JetStreamPublisher: class {
      publish = publishMock;
      constructor(public nc: unknown, public serviceName: string) {}
    },
  };
});

import { TRIP_SUBJECTS, TripEventPublisher } from '../src/events/trip-event.publisher';

function makePublisher() {
  const publisher = new TripEventPublisher();
  publisher.init({ jetstream: () => ({}) } as any);
  return publisher;
}

const baseTrip = {
  id: 'trip-1',
  riderId: 'rider-1',
  driverId: 'driver-1',
  pickupLat: 30.0444,
  pickupLng: 31.2357,
  dropoffLat: 30.0131,
  dropoffLng: 31.2089,
  pickupAddress: 'Tahrir',
  dropoffAddress: 'Giza',
  estimatedFare: 10_385,
  paymentMethod: 'CASH',
  requestedAt: new Date('2026-01-01T00:00:00Z'),
};

afterEach(() => {
  publishMock.mockClear();
});

describe('TripEventPublisher', () => {
  it('init builds a JetStream publisher for trip-service', () => {
    const publisher = new TripEventPublisher();
    expect(() => publisher.init({} as any)).not.toThrow();
  });

  it('publishTripRequested maps the trip snapshot into the request payload', async () => {
    await makePublisher().publishTripRequested(
      { ...baseTrip, promoCode: 'SAVE10' },
      'trace-1',
    );

    expect(publishMock).toHaveBeenCalledWith(
      TRIP_SUBJECTS.TRIP_REQUESTED,
      'trip_requested',
      {
        tripId: 'trip-1',
        riderId: 'rider-1',
        pickupLocation: { lat: 30.0444, lng: 31.2357 },
        dropoffLocation: { lat: 30.0131, lng: 31.2089 },
        pickupAddress: 'Tahrir',
        dropoffAddress: 'Giza',
        estimatedFare: 10_385,
        paymentMethod: 'CASH',
        promoCode: 'SAVE10',
        requestedAt: '2026-01-01T00:00:00.000Z',
      },
      { traceId: 'trace-1' },
    );
  });

  it('publishTripStarted uses the trip startedAt when present', async () => {
    const startedAt = new Date('2026-02-02T10:00:00Z');
    await makePublisher().publishTripStarted(
      { ...baseTrip, pickupLat: 30.05, pickupLng: 31.2, startedAt },
      'trace-2',
    );

    expect(publishMock).toHaveBeenCalledWith(
      TRIP_SUBJECTS.TRIP_STARTED,
      'trip_started',
      {
        tripId: 'trip-1',
        driverId: 'driver-1',
        riderId: 'rider-1',
        startedAt: '2026-02-02T10:00:00.000Z',
        pickupLocation: { lat: 30.05, lng: 31.2 },
      },
      { traceId: 'trace-2' },
    );
  });

  it('publishTripStarted falls back to now when startedAt is missing', async () => {
    const before = Date.now();
    await makePublisher().publishTripStarted({ ...baseTrip, startedAt: null });

    const payload = publishMock.mock.calls[0][2];
    expect(Date.parse(payload.startedAt)).toBeGreaterThanOrEqual(before);
  });

  it('publishTripCompleted maps fare and route totals, defaulting nulls to zero', async () => {
    const completedAt = new Date('2026-03-03T12:00:00Z');
    await makePublisher().publishTripCompleted(
      {
        ...baseTrip,
        actualFare: 9500,
        distance: null,
        duration: null,
        completedAt,
        dropoffLat: 30.01,
        dropoffLng: 31.2,
      },
      'trace-3',
    );

    expect(publishMock).toHaveBeenCalledWith(
      TRIP_SUBJECTS.TRIP_COMPLETED,
      'trip_completed',
      {
        tripId: 'trip-1',
        driverId: 'driver-1',
        riderId: 'rider-1',
        actualFare: 9500,
        distance: 0,
        duration: 0,
        completedAt: '2026-03-03T12:00:00.000Z',
        pickupLocation: { lat: 30.0444, lng: 31.2357 },
        dropoffLocation: { lat: 30.01, lng: 31.2 },
      },
      { traceId: 'trace-3' },
    );
  });

  it('publishTripCompleted stamps now when completedAt is missing', async () => {
    const before = Date.now();
    await makePublisher().publishTripCompleted({ ...baseTrip, actualFare: 1, completedAt: null });

    const payload = publishMock.mock.calls[0][2];
    expect(Date.parse(payload.completedAt)).toBeGreaterThanOrEqual(before);
  });

  it('publishTripCancelled carries the actor, reason and cancelledAt', async () => {
    const cancelledAt = new Date('2026-04-04T09:30:00Z');
    await makePublisher().publishTripCancelled(
      { id: 'trip-1', driverId: null, riderId: 'rider-1', cancelledAt },
      'RIDER',
      'no show',
      'trace-4',
    );

    expect(publishMock).toHaveBeenCalledWith(
      TRIP_SUBJECTS.TRIP_CANCELLED,
      'trip_cancelled',
      {
        tripId: 'trip-1',
        driverId: null,
        riderId: 'rider-1',
        cancelledBy: 'RIDER',
        cancellationReason: 'no show',
        cancelledAt: '2026-04-04T09:30:00.000Z',
      },
      { traceId: 'trace-4' },
    );
  });

  it('publishTripCancelled stamps now when cancelledAt is missing', async () => {
    const before = Date.now();
    await makePublisher().publishTripCancelled(
      { id: 'trip-1', riderId: 'rider-1', cancelledAt: null },
      'SYSTEM',
      'timeout',
    );

    const payload = publishMock.mock.calls[0][2];
    expect(Date.parse(payload.cancelledAt)).toBeGreaterThanOrEqual(before);
  });

  it('publishTripRejected defaults the reason to DRIVER_REJECTED', async () => {
    await makePublisher().publishTripRejected(
      { id: 'trip-1', driverId: 'driver-1', riderId: 'rider-1', reason: null },
      'trace-5',
    );

    const [subject, eventType, payload, options] = publishMock.mock.calls[0];
    expect(subject).toBe(TRIP_SUBJECTS.TRIP_REJECTED);
    expect(eventType).toBe('trip_rejected');
    expect(payload).toMatchObject({
      tripId: 'trip-1',
      driverId: 'driver-1',
      riderId: 'rider-1',
      reason: 'DRIVER_REJECTED',
    });
    expect(Date.parse(payload.rejectedAt)).toBeGreaterThan(0);
    expect(options).toEqual({ traceId: 'trace-5' });
  });

  it('publishTripMatched forwards the driver snapshot with a matchedAt stamp', async () => {
    const data = {
      tripId: 'trip-1',
      driverId: 'driver-1',
      driverName: 'Ali',
      driverPhone: '+20100',
      driverRating: 4.8,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehiclePlate: 'ABC 123',
      estimatedArrival: 5,
      distance: 4200,
    };
    await makePublisher().publishTripMatched(data, 'trace-6');

    const [subject, eventType, payload, options] = publishMock.mock.calls[0];
    expect(subject).toBe(TRIP_SUBJECTS.TRIP_MATCHED);
    expect(eventType).toBe('trip_matched');
    expect(payload).toEqual({ ...data, matchedAt: expect.any(String) });
    expect(options).toEqual({ traceId: 'trace-6' });
  });

  it('publishSOSCreated maps the sos snapshot with a createdAt stamp', async () => {
    await makePublisher().publishSOSCreated(
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

    const [subject, eventType, payload] = publishMock.mock.calls[0];
    expect(subject).toBe(TRIP_SUBJECTS.SOS_CREATED);
    expect(eventType).toBe('sos_created');
    expect(payload).toMatchObject({
      sosId: 'sos-1',
      tripId: 'trip-1',
      userId: 'rider-1',
      userType: 'RIDER',
      location: { lat: 30.05, lng: 31.23 },
      reason: 'panic',
    });
    expect(Date.parse(payload.createdAt)).toBeGreaterThan(0);
  });

  it('publishSOSResolved maps the resolution with a resolvedAt stamp', async () => {
    await makePublisher().publishSOSResolved(
      { sosId: 'sos-1', resolvedBy: 'admin-1', resolution: 'RESOLVED', notes: 'ok' },
      'trace-8',
    );

    const [subject, eventType, payload] = publishMock.mock.calls[0];
    expect(subject).toBe(TRIP_SUBJECTS.SOS_RESOLVED);
    expect(eventType).toBe('sos_resolved');
    expect(payload).toMatchObject({
      sosId: 'sos-1',
      resolvedBy: 'admin-1',
      resolution: 'RESOLVED',
      notes: 'ok',
    });
    expect(Date.parse(payload.resolvedAt)).toBeGreaterThan(0);
  });
});
