/**
 * Shared helpers for trip-service tests.
 *
 * Integration suites assume the docker infra from apps/backend is running
 * (pnpm docker:infra:up): postgres on 5433, redis cluster on 6379-6384,
 * nats on 4222-4224. @ain-rider/test-utils wires the env defaults.
 */
import { Test } from "@nestjs/testing";
import type { NestFastifyApplication } from "@nestjs/platform-fastify";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import type { NatsConnection } from "nats";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/shared/filters/global-exception.filter";
import { TraceInterceptor } from "../src/shared/interceptors/trace.interceptor";
import {
  ensureTestDatabase,
  loadTestEnv,
  resetTestDatabase,
} from "@ain-rider/test-utils";

export const INTERNAL_SECRET = "test-internal-secret";

/**
 * Point DATABASE_URL at the dedicated ainrider_trip_test database and apply
 * the rest of the harness env defaults (nats/redis). Call before booting the
 * app or the PrismaService constructor.
 */
export async function setupTripTestEnv(): Promise<void> {
  loadTestEnv();
  process.env.DATABASE_URL = await ensureTestDatabase("trip");
  process.env.INTERNAL_SERVICE_SECRET = INTERNAL_SECRET;
  // Parallel suites share one NATS cluster: extend the shared streams to
  // the full subject union before anything publishes (uncovered subjects
  // never receive a JetStream ack).
  const { createTestNatsConnection, provisionSharedStreams } =
    await import("@ain-rider/test-utils");
  const nc = await createTestNatsConnection("trip-provision");
  try {
    await provisionSharedStreams(nc);
  } finally {
    await nc.close();
  }
}

export async function resetTrips(): Promise<void> {
  await resetTestDatabase("trip");
}

/** Boot the full AppModule (real DB, NATS, redis) with main.ts's globals. */
export async function bootstrapTestApp(): Promise<NestFastifyApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalInterceptors(new TraceInterceptor());
  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.init();
  return app;
}

/** Sign the internal service JWT the InternalAuthGuard expects. */
export async function makeInternalToken(
  claims: Record<string, unknown> = {},
): Promise<string> {
  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: INTERNAL_SECRET })],
  }).compile();
  await moduleRef.init();
  const jwt = moduleRef.get(JwtService);
  return jwt.signAsync({ internal: true, service: "admin-service", ...claims });
}

/** Purge JetStream state so a fresh app boot sees an empty consumer cursor. */
export async function purgeTripStream(nc: NatsConnection): Promise<void> {
  const jsm = await nc.jetstreamManager();
  try {
    await jsm.consumers.delete("AIN_RIDER_OPS", "trip-lifecycle-consumer");
  } catch {
    // consumer does not exist yet — fine
  }
  try {
    await jsm.streams.purge("AIN_RIDER_OPS");
  } catch {
    // stream does not exist yet — fine
  }
}

/**
 * Resolve with the first JetStream-published event on `subject` whose decoded
 * envelope payload satisfies `predicate`. JetStream publishes flow through
 * core NATS subjects, so a plain subscription observes them. Subscribe BEFORE
 * triggering the action under test.
 */
export function waitForEvent<T = any>(
  nc: NatsConnection,
  subject: string,
  predicate: (data: T) => boolean = () => true,
  timeoutMs = 10_000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const sub = nc.subscribe(subject);
    const timer = setTimeout(() => {
      sub.unsubscribe();
      reject(new Error(`Timed out waiting for event on ${subject}`));
    }, timeoutMs);
    (async () => {
      for await (const msg of sub) {
        const envelope = JSON.parse(new TextDecoder().decode(msg.data));
        if (predicate(envelope.data as T)) {
          clearTimeout(timer);
          sub.unsubscribe();
          resolve(envelope.data as T);
          return;
        }
      }
    })().catch((err) => {
      clearTimeout(timer);
      sub.unsubscribe();
      reject(err);
    });
  });
}

/** Request-reply over core NATS; resolves the parsed JSON response. */
export async function natsRequest(
  nc: NatsConnection,
  subject: string,
  payload: unknown,
  timeoutMs = 10_000,
): Promise<any> {
  const res = await nc.request(
    subject,
    new TextEncoder().encode(JSON.stringify(payload)),
    { timeout: timeoutMs },
  );
  return JSON.parse(new TextDecoder().decode(res.data));
}

export const CAIRO_PICKUP = { lat: 30.0444, lng: 31.2357 };
export const CAIRO_DROPOFF = { lat: 30.0131, lng: 31.2089 };

export function createTripPayload(overrides: Record<string, unknown> = {}) {
  return {
    riderId: "11111111-1111-4111-8111-111111111111",
    pickupLat: CAIRO_PICKUP.lat,
    pickupLng: CAIRO_PICKUP.lng,
    pickupAddress: "Tahrir Square, Cairo",
    dropoffLat: CAIRO_DROPOFF.lat,
    dropoffLng: CAIRO_DROPOFF.lng,
    dropoffAddress: "Giza Pyramids Road",
    estimatedFare: 10_385,
    ...overrides,
  };
}
