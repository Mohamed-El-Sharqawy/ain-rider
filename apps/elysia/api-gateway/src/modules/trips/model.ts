import { t, type Static } from 'elysia';

export const TripModel = {
  requestBody: t.Object({
    pickupLatitude: t.Number(),
    pickupLongitude: t.Number(),
    pickupAddress: t.String(),
    dropoffLatitude: t.Number(),
    dropoffLongitude: t.Number(),
    dropoffAddress: t.String(),
    estimatedFare: t.Number({ minimum: 0 }),
    paymentMethod: t.Optional(t.Literal('CASH')),
    promoCode: t.Optional(t.String()),
  }),
  estimateBody: t.Object({
    pickupLatitude: t.Number(),
    pickupLongitude: t.Number(),
    dropoffLatitude: t.Number(),
    dropoffLongitude: t.Number(),
  }),
  statusUpdateBody: t.Object({
    status: t.String(),
  }),
  tripIdParams: t.Object({
    id: t.String(),
  }),
} as const;

export type TripRequestBody = Static<typeof TripModel.requestBody>;
export type EstimateRequestBody = Static<typeof TripModel.estimateBody>;
