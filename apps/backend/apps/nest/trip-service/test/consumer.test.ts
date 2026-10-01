/**
 * TripLifecycleConsumer unit suite.
 *
 * JetStreamConsumer is mocked at the module boundary so onModuleInit can be
 * driven without infra; the captured anonymous subclass instance is exercised
 * directly to pin every handleMessage branch (assigned/matched/ignored/error).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const consumerInstances: any[] = [];

vi.mock('@ain-rider/nats-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain-rider/nats-client')>();
  class FakeJetStreamConsumer {
    started = false;
    stopped = false;
    constructor(
      public nc: unknown,
      public config: Record<string, unknown>,
      services?: unknown,
    ) {
      consumerInstances.push(this);
    }
    async start() {
      this.started = true;
    }
    async stop() {
      this.stopped = true;
    }
  }
  return { ...actual, JetStreamConsumer: FakeJetStreamConsumer as any };
});

import { TripLifecycleConsumer } from '../src/consumers/trip-lifecycle.consumer';
import { TripStatus } from '@ain-rider/shared-types';

function makeTripsService() {
  return { updateStatus: vi.fn().mockResolvedValue({ id: 'trip-1' }) };
}

function envelope(data: unknown) {
  return { data } as any;
}

beforeEach(() => {
  consumerInstances.length = 0;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TripLifecycleConsumer', () => {
  it('starts a JetStream consumer with the ops-stream config once NATS is up', async () => {
    vi.useFakeTimers();
    const trips = makeTripsService();
    const nats: any = { nc: null as any, idempotency: { mark: true } };
    const consumer = new TripLifecycleConsumer(trips as any, nats);

    const done = consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(150);
    nats.nc = { jetstream: () => ({}) };
    await vi.advanceTimersByTimeAsync(100);
    await done;

    const instance = consumerInstances[0];
    expect(instance.started).toBe(true);
    expect(instance.config).toMatchObject({
      streamName: 'AIN_RIDER_OPS',
      consumerName: 'trip-lifecycle-consumer',
      serviceName: 'trip-service',
      filterSubject: 'ain_rider.trip_*',
      maxDeliver: 3,
      enableIdempotency: true,
      enableDLQ: true,
    });
    expect((consumer as any).consumer).toBe(instance);
  });

  it('gives up after the retry window when NATS never connects', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consumer = new TripLifecycleConsumer(makeTripsService() as any, { nc: null } as any);

    const done = consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_200);
    await done;

    expect(consumerInstances).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('NATS connection not available after 5s'),
    );
  });

  it('handleMessage maps trip_assigned to ASSIGNED with driver metadata', async () => {
    vi.useFakeTimers();
    const trips = makeTripsService();
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(trips as any, nats);
    await consumer.onModuleInit();
    const handler = consumerInstances[0].handleMessage.bind(consumerInstances[0]);

    await handler(
      envelope({
        tripId: 'trip-1',
        driverId: 'driver-1',
        driverName: 'Ali',
        driverPhone: '+20100',
        driverRating: 4.5,
        vehicleMake: 'Toyota',
        vehicleModel: 'Corolla',
        vehiclePlate: 'ABC 123',
      }),
      { subject: 'ain_rider.trip_assigned' } as any,
      'trace-1',
    );

    expect(trips.updateStatus).toHaveBeenCalledWith('trip-1', TripStatus.ASSIGNED, 'driver-1', 'trace-1', {
      driverName: 'Ali',
      driverPhone: '+20100',
      driverRating: 4.5,
      vehicleMake: 'Toyota',
      vehicleModel: 'Corolla',
      vehiclePlate: 'ABC 123',
    });
  });

  it('handleMessage maps trip_matched to MATCHED', async () => {
    vi.useFakeTimers();
    const trips = makeTripsService();
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(trips as any, nats);
    await consumer.onModuleInit();
    const handler = consumerInstances[0].handleMessage.bind(consumerInstances[0]);

    await handler(envelope({ tripId: 'trip-2', driverId: 'driver-2' }), {
      subject: 'ain_rider.trip_matched',
    } as any, 'trace-2');

    expect(trips.updateStatus).toHaveBeenCalledWith('trip-2', TripStatus.MATCHED, 'driver-2', 'trace-2', {
      driverName: undefined,
      driverPhone: undefined,
      driverRating: undefined,
      vehicleMake: undefined,
      vehicleModel: undefined,
      vehiclePlate: undefined,
    });
  });

  it('handleMessage ignores events without a tripId', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const trips = makeTripsService();
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(trips as any, nats);
    await consumer.onModuleInit();
    const handler = consumerInstances[0].handleMessage.bind(consumerInstances[0]);

    await handler(envelope({}), { subject: 'ain_rider.trip_assigned' } as any, 'trace-3');

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Invalid payload: missing tripId'));
    expect(trips.updateStatus).not.toHaveBeenCalled();
  });

  it('handleMessage ignores unrelated subjects', async () => {
    vi.useFakeTimers();
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const trips = makeTripsService();
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(trips as any, nats);
    await consumer.onModuleInit();
    const handler = consumerInstances[0].handleMessage.bind(consumerInstances[0]);

    await handler(envelope({ tripId: 'trip-3' }), { subject: 'ain_rider.trip_no_match' } as any, 'trace-4');

    expect(trips.updateStatus).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('Processing'));
  });

  it('handleMessage rethrows service failures for redelivery', async () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const trips = makeTripsService();
    trips.updateStatus.mockRejectedValue(new Error('db down'));
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(trips as any, nats);
    await consumer.onModuleInit();
    const handler = consumerInstances[0].handleMessage.bind(consumerInstances[0]);

    await expect(
      handler(envelope({ tripId: 'trip-4' }), { subject: 'ain_rider.trip_matched' } as any, 'trace-5'),
    ).rejects.toThrow('db down');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to update trip status'), expect.any(Error));
  });

  it('onModuleDestroy stops a running consumer', async () => {
    vi.useFakeTimers();
    const nats: any = { nc: { jetstream: () => ({}) }, idempotency: {} };
    const consumer = new TripLifecycleConsumer(makeTripsService() as any, nats);
    await consumer.onModuleInit();

    await consumer.onModuleDestroy();

    expect(consumerInstances[0].stopped).toBe(true);
  });

  it('onModuleDestroy is a no-op when startup bailed early', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const consumer = new TripLifecycleConsumer(makeTripsService() as any, { nc: null } as any);
    const done = consumer.onModuleInit();
    await vi.advanceTimersByTimeAsync(5_200);
    await done;

    await expect(consumer.onModuleDestroy()).resolves.toBeUndefined();
  });
});
