import { t, type Static } from 'elysia';

export const MatchModel = {
  driverAvailableBody: t.Object({
    driverId: t.String(),
    latitude: t.Number({ minimum: -90, maximum: 90 }),
    longitude: t.Number({ minimum: -180, maximum: 180 }),
    vehicleTypeId: t.String(),
  }),
  driverUnavailableBody: t.Object({
    driverId: t.String(),
  }),
  manualMatchBody: t.Object({
    tripId: t.String(),
    riderId: t.String(),
    pickupLatitude: t.Number(),
    pickupLongitude: t.Number(),
    dropoffLatitude: t.Number(),
    dropoffLongitude: t.Number(),
  }),
} as const;

export type DriverAvailableBody = Static<typeof MatchModel.driverAvailableBody>;

export interface AvailableDriver {
  driverId: string;
  latitude: number;
  longitude: number;
  vehicleTypeId: string;
  h3Index: string;
  availableSince: number;
}
