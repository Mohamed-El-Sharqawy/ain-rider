import { t, type Static } from 'elysia';

export const TripModel = {
  requestBody: t.Object({
    pickupLatitude: t.Number({ minimum: -90, maximum: 90 }),
    pickupLongitude: t.Number({ minimum: -180, maximum: 180 }),
    pickupAddress: t.String(),
    dropoffLatitude: t.Number({ minimum: -90, maximum: 90 }),
    dropoffLongitude: t.Number({ minimum: -180, maximum: 180 }),
    dropoffAddress: t.String(),
    estimatedFare: t.Number({ minimum: 0 }),
    paymentMethod: t.Optional(t.Literal('CASH')),
    promoCode: t.Optional(t.String()),
  }),
  estimateBody: t.Object({
    pickupLatitude: t.Number({ minimum: -90, maximum: 90 }),
    pickupLongitude: t.Number({ minimum: -180, maximum: 180 }),
    dropoffLatitude: t.Number({ minimum: -90, maximum: 90 }),
    dropoffLongitude: t.Number({ minimum: -180, maximum: 180 }),
  }),
  statusUpdateBody: t.Object({
    status: t.Union([
      t.Literal('MATCHED'),
      t.Literal('IN_PROGRESS'),
      t.Literal('COMPLETED'),
      t.Literal('CANCELLED'),
    ]),
  }),
  tripIdParams: t.Object({
    id: t.String(),
  }),
} as const;

export type TripRequestBody = Static<typeof TripModel.requestBody>;
export type EstimateRequestBody = Static<typeof TripModel.estimateBody>;
