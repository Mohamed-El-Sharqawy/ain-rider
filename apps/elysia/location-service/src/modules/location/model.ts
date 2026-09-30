import { t, type Static } from 'elysia';

export const LocationModel = {
  updateBody: t.Object({
    driverId: t.String({ pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' }),
    latitude: t.Number({ minimum: -90, maximum: 90 }),
    longitude: t.Number({ minimum: -180, maximum: 180 }),
    heading: t.Optional(t.Number({ minimum: 0, maximum: 360 })),
    speed: t.Optional(t.Number({ minimum: 0 })),
  }),
  nearbyQuery: t.Object({
    latitude: t.Numeric({ minimum: -90, maximum: 90 }),
    longitude: t.Numeric({ minimum: -180, maximum: 180 }),
    radiusKm: t.Optional(t.Numeric({ minimum: 0.1, maximum: 50, default: 5 })),
  }),
  historyQuery: t.Object({
    driverId: t.String({ pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' }),
    from: t.String(),
    to: t.Optional(t.String()),
  }),
} as const;

export type LocationUpdateBody = Static<typeof LocationModel.updateBody>;
export type NearbyQuery = Static<typeof LocationModel.nearbyQuery>;
