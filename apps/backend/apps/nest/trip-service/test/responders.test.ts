/**
 * NATS responders + TripCommandsService unit suite.
 *
 * The NatsResponder transport is mocked at the module boundary: each suite
 * captures the (subject, handler) registrations and drives the handlers
 * directly, pinning the request -> TripsService -> response wiring. The
 * 5-second NATS-wait retry loops run under fake timers.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Registration = { subject: string; handler: (req: any) => Promise<any> };
const registrations: Registration[] = [];

vi.mock('@ain-rider/nats-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@ain-rider/nats-client')>();
  return {
    ...actual,
    NatsResponder: class {
      constructor(public nc: unknown) {}
      async respond(subject: string, handler: (req: any) => Promise<any>) {
        registrations.push({ subject, handler });
      }
      async close() {}
    },
  };
});

import { TripAssignDriverResponder } from '../src/nats/responders/trip-assign-driver.responder';
import { TripCancelResponder } from '../src/nats/responders/trip-cancel.responder';
import { TripCreateResponder } from '../src/nats/responders/trip-create.responder';
import { TripUpdateStatusResponder } from '../src/nats/responders/trip-update-status.responder';
import { TripCommandsService } from '../src/trips/trip-commands.service';
import { NATS_REQUESTS, TripStatus } from '@ain-rider/shared-types';

function makeTripsService() {
  return {
    createTrip: vi.fn().mockResolvedValue({ id: 'trip-1', status: 'REQUESTED', estimatedFare: 10_385 }),
    cancelTrip: vi.fn().mockResolvedValue({ id: 'trip-1', status: 'CANCELLED' }),
    updateStatus: vi.fn().mockResolvedValue({ id: 'trip-1', status: 'MATCHED' }),
    assignDriver: vi.fn().mockResolvedValue({ id: 'trip-1' }),
  };
}

/** Fast-forward the 100ms retry sleeps of onModuleInit until it settles. */
async function runInit(init: () => Promise<unknown>): Promise<void> {
  const done = init();
  for (let i = 0; i < 60 && !isSettled(done); i++) {
    await vi.advanceTimersByTimeAsync(100);
  }
  await done;
}

function isSettled(p: Promise<unknown>): boolean {
  let settled = false;
  p.then(
    () => (settled = true),
    () => (settled = true),
  );
  return settled;
}

beforeEach(() => {
  registrations.length = 0;
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('TripCreateResponder', () => {
  it('registers on trip.create.request and creates the trip from the request payload', async () => {
    const trips = makeTripsService();
    const responder = new TripCreateResponder(trips as any, { nc: {} } as any);

    await runInit(() => responder.onModuleInit());

    expect(registrations).toEqual([{ subject: 'trip.create.request', handler: expect.any(Function) }]);

    const reply = await registrations[0].handler({
      riderId: 'rider-1',
      pickupLat: 30.0444,
      pickupLng: 31.2357,
      pickupAddress: 'Tahrir',
      dropoffLat: 30.0131,
      dropoffLng: 31.2089,
      dropoffAddress: 'Giza',
      estimatedFare: 10_385,
      paymentMethod: 'CASH',
      promoCode: 'SAVE10',
      traceId: 'trace-1',
    });

    expect(trips.createTrip).toHaveBeenCalledWith(
      {
        riderId: 'rider-1',
        pickupLat: 30.0444,
        pickupLng: 31.2357,
        pickupAddress: 'Tahrir',
        dropoffLat: 30.0131,
        dropoffLng: 31.2089,
        dropoffAddress: 'Giza',
        estimatedFare: 10_385,
        paymentMethod: 'CASH',
        promoCode: 'SAVE10',
      },
      'trace-1',
    );
    expect(reply).toEqual({ tripId: 'trip-1', status: 'REQUESTED', estimatedFare: 10_385 });
  });

  it('rejects requests missing required fields', async () => {
    const trips = makeTripsService();
    const responder = new TripCreateResponder(trips as any, { nc: {} } as any);
    await runInit(() => responder.onModuleInit());

    await expect(registrations[0].handler({ riderId: 'rider-1' })).rejects.toThrow(
      /Missing required fields/,
    );
    expect(trips.createTrip).not.toHaveBeenCalled();
  });

  it('gives up after the retry window when NATS never connects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const responder = new TripCreateResponder(makeTripsService() as any, { nc: null } as any);

    await runInit(() => responder.onModuleInit());

    expect(registrations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NATS connection not available'));
  });

  it('onModuleDestroy closes the responder when one was registered', async () => {
    const responder = new TripCreateResponder(makeTripsService() as any, { nc: {} } as any);
    await runInit(() => responder.onModuleInit());
    const closeSpy = vi.spyOn((responder as any).responder, 'close').mockResolvedValue();

    await responder.onModuleDestroy();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('onModuleDestroy is a no-op when startup bailed early', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const responder = new TripCreateResponder(makeTripsService() as any, { nc: null } as any);
    await runInit(() => responder.onModuleInit());

    await expect(responder.onModuleDestroy()).resolves.toBeUndefined();
  });
});

describe('TripCancelResponder', () => {
  it('registers on trip.cancel.request and cancels through the service', async () => {
    const trips = makeTripsService();
    const responder = new TripCancelResponder(trips as any, { nc: {} } as any);
    await runInit(() => responder.onModuleInit());

    const reply = await registrations[0].handler({
      tripId: 'trip-1',
      reason: 'rider changed mind',
      cancelledBy: 'RIDER',
    });

    expect(registrations[0].subject).toBe('trip.cancel.request');
    expect(trips.cancelTrip).toHaveBeenCalledWith('trip-1', 'rider changed mind', 'RIDER');
    expect(reply).toEqual({ tripId: 'trip-1', newStatus: 'CANCELLED' });
  });

  it('gives up after the retry window when NATS never connects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const responder = new TripCancelResponder(makeTripsService() as any, { nc: null } as any);

    await runInit(() => responder.onModuleInit());

    expect(registrations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NATS connection not available'));
  });
});

describe('TripAssignDriverResponder', () => {
  it('registers on trip.assign_driver.request and assigns through the service', async () => {
    const trips = makeTripsService();
    const responder = new TripAssignDriverResponder(trips as any, { nc: {} } as any);
    await runInit(() => responder.onModuleInit());

    const reply = await registrations[0].handler({
      tripId: 'trip-1',
      driverId: 'driver-1',
      assignedBy: 'admin-1',
    });

    expect(registrations[0].subject).toBe('trip.assign_driver.request');
    expect(trips.assignDriver).toHaveBeenCalledWith('trip-1', 'driver-1', 'admin-1');
    expect(reply).toEqual({ tripId: 'trip-1', driverId: 'driver-1' });
  });

  it('gives up after the retry window when NATS never connects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const responder = new TripAssignDriverResponder(makeTripsService() as any, { nc: null } as any);

    await runInit(() => responder.onModuleInit());

    expect(registrations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NATS connection not available'));
  });
});

describe('TripUpdateStatusResponder', () => {
  it('registers on trip.update_status.request and reports the new status', async () => {
    const trips = makeTripsService();
    trips.updateStatus.mockResolvedValue({ id: 'trip-1', status: 'IN_PROGRESS' });
    const responder = new TripUpdateStatusResponder(trips as any, { nc: {} } as any);
    await runInit(() => responder.onModuleInit());

    const reply = await registrations[0].handler({
      tripId: 'trip-1',
      status: 'IN_PROGRESS',
      driverId: 'driver-1',
      traceId: 'trace-2',
    });

    expect(registrations[0].subject).toBe('trip.update_status.request');
    expect(trips.updateStatus).toHaveBeenCalledWith('trip-1', 'IN_PROGRESS', 'driver-1', 'trace-2');
    expect(reply).toEqual({ tripId: 'trip-1', previousStatus: 'IN_PROGRESS', newStatus: 'IN_PROGRESS' });
  });

  it('gives up after the retry window when NATS never connects', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const responder = new TripUpdateStatusResponder(makeTripsService() as any, { nc: null } as any);

    await runInit(() => responder.onModuleInit());

    expect(registrations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('NATS connection not available'));
  });
});

describe('TripCommandsService', () => {
  it('waits for the responder, registers all three admin commands and routes them', async () => {
    const trips = makeTripsService();
    const respond = vi.fn(async (subject: string, handler: any) => {
      registrations.push({ subject, handler });
    });
    const nats: any = { responder: undefined as any };
    const svc = new TripCommandsService(
      { get responder() { return nats.responder; } } as any,
      trips as any,
    );

    const done = svc.onModuleInit();
    await vi.advanceTimersByTimeAsync(150);
    nats.responder = { respond };
    await vi.advanceTimersByTimeAsync(100);
    await done;

    expect(registrations.map((r) => r.subject)).toEqual([
      NATS_REQUESTS.TRIP_CANCEL,
      NATS_REQUESTS.TRIP_UPDATE_STATUS,
      NATS_REQUESTS.TRIP_ASSIGN_DRIVER,
    ]);

    await registrations[0].handler({ tripId: 'trip-1', reason: 'r', cancelledBy: 'SYSTEM' });
    expect(trips.cancelTrip).toHaveBeenCalledWith('trip-1', 'r', 'SYSTEM');

    await registrations[1].handler({ tripId: 'trip-1', status: 'IN_PROGRESS' });
    expect(trips.updateStatus).toHaveBeenCalledWith('trip-1', 'IN_PROGRESS', undefined);

    await registrations[2].handler({ tripId: 'trip-1', driverId: 'driver-1' });
    expect(trips.updateStatus).toHaveBeenCalledWith('trip-1', TripStatus.MATCHED, 'driver-1');
  });

  it('logs and bails when the NATS responder never appears', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const svc = new TripCommandsService({ responder: undefined } as any, makeTripsService() as any);

    await runInit(() => svc.onModuleInit());

    expect(registrations).toEqual([]);
    expect(errorSpy).toHaveBeenCalledWith('[TripCommands] NATS responder not available after 5s');
  });
});
