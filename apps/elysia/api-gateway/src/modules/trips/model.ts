import { t, type Static } from 'elysia';

export const TripModel = {
  requestBody: t.Object({
    pickupLatitude: t.Number(),
    pickupLongitude: t.Number(),
    pickupAddress: t.String(),
    dropoffLatitude: t.Number(),
    dropoffLongitude: t.Number(),
    dropoffAddress: t.String(),
    paymentMethod: t.Optional(t.Literal('CASH')), // Currently only CASH is supported
    promoCode: t.Optional(t.String()),
  }),
  tripIdParams: t.Object({
    id: t.String(),
  }),
} as const;

export type TripRequestBody = Static<typeof TripModel.requestBody>;
