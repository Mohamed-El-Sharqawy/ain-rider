import { describe, expect, test } from 'vitest';
import { createEventEnvelope } from '../src/types/event-envelope';
import { createDLQMessage } from '../src/types/dlq-message';
import {
  createErrorResponse,
  createNatsRequest,
  createSuccessResponse,
} from '../src/types/requests';
import type {
  CancelTripRequest,
  SuspendUserRequest,
  TripRequestedPayload,
} from '../src/types/events';
// Import the barrels so their re-export statements execute under coverage.
import '../src/types';
import '../src/types/events';
import '../src/types/requests';

describe('createEventEnvelope', () => {
  test('fills generated metadata around the payload', () => {
    const data = { hello: 'world' };
    const before = new Date();
    const envelope = createEventEnvelope('trip_requested', data, {
      eventId: 'evt-1',
      traceId: 't'.repeat(32),
      source: 'test-service',
    });
    const after = new Date();

    expect(envelope.version).toBe(1);
    expect(envelope.eventType).toBe('trip_requested');
    expect(envelope.eventId).toBe('evt-1');
    expect(envelope.idempotencyKey).toBe('evt-1');
    expect(envelope.traceId).toBe('t'.repeat(32));
    expect(envelope.source).toBe('test-service');
    expect(envelope.data).toBe(data);
    expect(Date.parse(envelope.timestamp)).not.toBeNaN();
    expect(Date.parse(envelope.timestamp)).toBeGreaterThanOrEqual(
      before.getTime(),
    );
    expect(Date.parse(envelope.timestamp)).toBeLessThanOrEqual(
      after.getTime(),
    );
  });

  test('honors an explicit version', () => {
    const envelope = createEventEnvelope('payment_processed', { ok: true }, {
      eventId: 'evt-2',
      traceId: 'u'.repeat(32),
      source: 'test-service',
      version: 2,
    });
    expect(envelope.version).toBe(2);
  });
});

describe('createDLQMessage', () => {
  test('captures the failed message context', () => {
    const error = new Error('processing exploded');
    const dlq = createDLQMessage(
      'ain_rider.trip_matched',
      '{"eventId":"evt-9"}',
      { traceparent: '00-' + 'a'.repeat(32) + '-01' },
      'evt-9',
      't'.repeat(32),
      error,
      3,
      'trip-matched-consumer',
      'AIN_RIDER_OPS',
    );

    expect(dlq.originalSubject).toBe('ain_rider.trip_matched');
    expect(dlq.originalPayload).toBe('{"eventId":"evt-9"}');
    expect(dlq.originalHeaders).toEqual({
      traceparent: '00-' + 'a'.repeat(32) + '-01',
    });
    expect(dlq.originalEventId).toBe('evt-9');
    expect(dlq.traceId).toBe('t'.repeat(32));
    expect(dlq.errorReason).toBe('processing exploded');
    expect(dlq.errorStack).toBe(error.stack);
    expect(dlq.retryCount).toBe(3);
    expect(dlq.consumerName).toBe('trip-matched-consumer');
    expect(dlq.sourceStream).toBe('AIN_RIDER_OPS');
    expect(Date.parse(dlq.failedAt)).not.toBeNaN();
  });
});

describe('request/reply factories', () => {
  test('createNatsRequest wraps payload with trace metadata', () => {
    const payload: CancelTripRequest = {
      tripId: 'trip-1',
      cancelledBy: 'ADMIN',
      reason: 'ops test',
    };
    const request = createNatsRequest(payload, {
      traceId: 'r'.repeat(32),
      requestedBy: 'admin-service',
    });
    expect(request).toEqual({
      traceId: 'r'.repeat(32),
      requestedBy: 'admin-service',
      timestamp: request.timestamp,
      data: payload,
    });
    expect(Date.parse(request.timestamp)).not.toBeNaN();
  });

  test('createSuccessResponse mirrors the trace id', () => {
    expect(createSuccessResponse({ id: 1 }, 'x'.repeat(32))).toEqual({
      success: true,
      traceId: 'x'.repeat(32),
      data: { id: 1 },
    });
  });

  test('createErrorResponse carries code, message and optional details', () => {
    const withoutDetails = createErrorResponse('NOT_FOUND', 'nope', 'y'.repeat(32));
    expect(withoutDetails).toEqual({
      success: false,
      traceId: 'y'.repeat(32),
      error: { code: 'NOT_FOUND', message: 'nope', details: undefined },
    });

    const withDetails = createErrorResponse('VALIDATION', 'bad', 'z'.repeat(32), {
      field: 'userId',
    });
    expect(withDetails.error?.details).toEqual({ field: 'userId' });
  });
});

describe('event payload types', () => {
  test('compile-time payloads keep their runtime shape', () => {
    const payload: TripRequestedPayload = {
      tripId: 'trip-1',
      riderId: 'rider-1',
      pickupLocation: { lat: 30.04, lng: 31.23 },
      dropoffLocation: { lat: 30.05, lng: 31.24 },
      pickupAddress: 'A',
      dropoffAddress: 'B',
      estimatedFare: 42.5,
      paymentMethod: 'CASH',
      promoCode: null,
      requestedAt: new Date().toISOString(),
    };
    const envelope = createEventEnvelope('trip_requested', payload, {
      eventId: 'evt-tp',
      traceId: 'v'.repeat(32),
      source: 'trip-service',
    });
    const suspend: SuspendUserRequest = {
      userId: 'user-1',
      reason: 'test',
      suspendedBy: 'admin',
    };
    expect(envelope.data.estimatedFare).toBe(42.5);
    expect(suspend.userId).toBe('user-1');
  });
});
