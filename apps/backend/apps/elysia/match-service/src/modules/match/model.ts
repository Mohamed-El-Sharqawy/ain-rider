import { t, type Static } from 'elysia';

export const MatchModel = {
  driverAvailableBody: t.Object({
    driverId: t.String(),
    latitude: t.Number({ minimum: -90, maximum: 90 }),
    longitude: t.Number({ minimum: -180, maximum: 180 }),
    vehicleTypeId: t.String(),
    driverName: t.Optional(t.String()),
    driverPhone: t.Optional(t.String()),
    driverRating: t.Optional(t.Number()),
    vehicleMake: t.Optional(t.String()),
    vehicleModel: t.Optional(t.String()),
    vehiclePlate: t.Optional(t.String()),
  }),
  driverUnavailableBody: t.Object({
    driverId: t.String(),
  }),
  manualMatchBody: t.Object({
    tripId: t.String(),
    riderId: t.String(),
    pickupLatitude: t.Number({ minimum: -90, maximum: 90 }),
    pickupLongitude: t.Number({ minimum: -180, maximum: 180 }),
    dropoffLatitude: t.Number({ minimum: -90, maximum: 90 }),
    dropoffLongitude: t.Number({ minimum: -180, maximum: 180 }),
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
  driverName?: string;
  driverPhone?: string;
  driverRating?: number;
  vehicleMake?: string;
  vehicleModel?: string;
  vehiclePlate?: string;
}
