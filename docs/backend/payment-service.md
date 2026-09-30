# Payment Service Code Review

**Workspace**: backend
**Domain**: payment-service
**Date**: 2026-04-07
**Files Reviewed**: 15+ files

## Summary

The Payment service handles cash payments and refunds for completed trips. It consumes `trip_completed` events to create payment records and exposes REST endpoints for payment confirmation and refunds. The service is relatively simple but has critical issues: no double-charge prevention, missing idempotency on payment creation, no validation for refund amounts, and missing authentication on endpoints. The schema uses strings instead of enums for status fields.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/main.ts` | Clean | 0 |
| `src/app.module.ts` | Clean | 0 |
| `src/payments/payments.controller.ts` | Issues found | 2 high |
| `src/payments/payments.service.ts` | Issues found | 2 high, 2 medium |
| `src/payments/payments.module.ts` | Clean | 0 |
| `src/payments/dto/create-payment.dto.ts` | Clean | 0 |
| `src/payments/dto/create-refund.dto.ts` | Issues found | 1 medium |
| `src/events/payment-event.publisher.ts` | Clean | 0 |
| `src/consumers/trip-completed.consumer.ts` | Issues found | 1 high |
| `src/nats/responders/payment-adjust.responder.ts` | Issues found | 1 low |
| `src/nats/responders/payment-refund.responder.ts` | Issues found | 1 medium |
| `prisma/schema.prisma` | Issues found | 2 medium |

---

### HIGH FINDINGS

### HIGH PAY-001: No Double-Charge Prevention

- **File**: `src/payments/payments.service.ts:15-30`
- **Category**: bug
- **Impact**: Multiple payments could be created for the same trip

**Description**

The `createPayment` method doesn't check if a payment already exists for the trip:
```typescript
async createPayment(data: { tripId: string; ... }) {
  const payment = await this.prisma.payment.create({
    data: { ...data, status: PaymentStatus.PENDING },
  });
  return payment;
}
```

If `trip_completed` event is delivered multiple times (NATS redelivery), multiple payment records would be created for the same trip.

**Recommendation**

Add upsert logic or check before creating:
```typescript
async createPayment(data: { tripId: string; ... }) {
  // Check for existing payment
  const existing = await this.prisma.payment.findUnique({
    where: { tripId: data.tripId }
  });
  if (existing) {
    console.log(`[PaymentsService] Payment already exists for trip ${data.tripId}`);
    return existing;
  }
  
  return this.prisma.payment.create({ data: { ...data, status: PaymentStatus.PENDING } });
}
```

Or use Prisma upsert:
```typescript
return this.prisma.payment.upsert({
  where: { tripId: data.tripId },
  create: { data, status: PaymentStatus.PENDING },
  update: {}, // Return existing without changes
});
```

---

### HIGH PAY-002: No Authentication on Payment Endpoints

- **File**: `src/payments/payments.controller.ts`
- **Category**: security
- **Impact**: Anyone can confirm cash collection, mark payments failed, or create refunds

**Description**

None of the endpoints have authentication guards:
```typescript
@Post()
create(@Body() body: CreatePaymentDto) { ... }

@Patch(':id/confirm-cash')
confirmCash(@Param('id') id: string, @Body('collectedBy') collectedBy: string) { ... }

@Patch(':id/mark-failed')
markFailed(@Param('id') id: string, @Body('reason') reason: string) { ... }

@Post(':id/refund')
refund(@Param('id') id: string, @Body() body: CreateRefundDto) { ... }
```

The service relies on the API Gateway for authentication, but direct access to the service (if exposed) would bypass all security.

**Recommendation**

Add `InternalAuthGuard` to all endpoints since they should only be called via gateway:
```typescript
@Controller('payments')
@UseGuards(InternalAuthGuard)
@ApiBearerAuth('internal-secret')
export class PaymentsController { ... }
```

---

### HIGH PAY-003: Refund Amount Not Validated Against Payment

- **File**: `src/payments/payments.service.ts:55-60`
- **Category**: bug
- **Impact**: Refunds could exceed payment amount

**Description**

The `createRefund` method doesn't validate the refund amount:
```typescript
async createRefund(paymentId: string, amount: number, reason: string) {
  const refund = await this.prisma.refund.create({
    data: { paymentId, amount, reason, status: 'PENDING' },
  });
  return refund;
}
```

No check that:
1. The payment exists
2. The refund amount doesn't exceed the payment amount
3. Total refunds don't exceed the payment amount

**Recommendation**

Add validation:
```typescript
async createRefund(paymentId: string, amount: number, reason: string) {
  const payment = await this.prisma.payment.findUnique({
    where: { id: paymentId },
    include: { refunds: true },
  });

  if (!payment) {
    throw new NotFoundException('Payment not found');
  }

  const totalRefunded = payment.refunds
    .filter(r => r.status !== 'REJECTED')
    .reduce((sum, r) => sum + r.amount, 0);

  if (amount > payment.amount - totalRefunded) {
    throw new BadRequestException('Refund amount exceeds available balance');
  }

  // ... create refund
}
```

---

### HIGH PAY-004: Trip Completed Consumer Creates Duplicate Payments

- **File**: `src/consumers/trip-completed.consumer.ts:55-75`
- **Category**: bug
- **Impact**: Same as PAY-001 - duplicate payment records

**Description**

The consumer calls `createPayment` without idempotency check:
```typescript
async handleMessage(envelope: EventEnvelope<unknown>, ...): Promise<void> {
  const payload = envelope.data as TripCompletedPayload;
  await this.paymentsService.createPayment({
    tripId: payload.tripId,
    // ...
  });
}
```

Even with idempotency enabled in the consumer config, the service doesn't implement idempotent payment creation.

**Recommendation**

Ensure the service implements idempotency as described in PAY-001, or use the idempotency key from the envelope in the payment creation logic.

---

### MEDIUM FINDINGS

### MEDIUM PAY-005: Payment Status Not Enforced as Enum

- **File**: `prisma/schema.prisma:13`
- **Category**: bug
- **Impact**: Invalid status strings could be stored

**Description**

Payment status is a plain string:
```prisma
status String @default("PENDING")
```

**Recommendation**

Add PaymentStatus enum:
```prisma
enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model Payment {
  status PaymentStatus @default(PENDING)
}
```

---

### MEDIUM PAY-006: Refund Status Not Enforced as Enum

- **File**: `prisma/schema.prisma:27`
- **Category**: bug
- **Impact**: Same as PAY-005

**Description**

Refund status is a plain string:
```prisma
status String @default("PENDING")
```

**Recommendation**

Add RefundStatus enum:
```prisma
enum RefundStatus {
  PENDING
  APPROVED
  PROCESSED
  REJECTED
}
```

---

### MEDIUM PAY-007: Refund Amount Has No Maximum Validation

- **File**: `src/payments/dto/create-refund.dto.ts:9`
- **Category**: bug
- **Impact**: Negative or zero refunds could be created

**Description**

The DTO only validates minimum:
```typescript
@IsNumber()
@Min(0.01)
amount: number;
```

There's no maximum validation. While 0.01 minimum is correct, the amount should be validated against the payment.

**Recommendation**

This validation should be in the service (PAY-003), but the DTO could add documentation:
```typescript
@ApiProperty({ description: 'Refund amount (cannot exceed payment amount)' })
@IsNumber()
@Min(0.01)
amount: number;
```

---

### MEDIUM PAY-008: Cash Confirmation Doesn't Validate Payment Status

- **File**: `src/payments/payments.service.ts:30-45`
- **Category**: bug
- **Impact**: Completed/failed payments could be re-confirmed

**Description**

The `confirmCashCollection` method doesn't check current status:
```typescript
async confirmCashCollection(paymentId: string, collectedBy: string) {
  const payment = await this.prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.COMPLETED,
      // ...
    },
  });
}
```

A payment that's already COMPLETED or FAILED could be "confirmed" again.

**Recommendation**

Add status validation:
```typescript
async confirmCashCollection(paymentId: string, collectedBy: string) {
  const existing = await this.prisma.payment.findUnique({ where: { id: paymentId } });
  
  if (!existing) {
    throw new NotFoundException('Payment not found');
  }
  
  if (existing.status !== PaymentStatus.PENDING) {
    throw new BadRequestException(`Cannot confirm payment in ${existing.status} status`);
  }
  
  // ... update
}
```

---

### MEDIUM PAY-009: Payment Adjust Responder Returns Wrong Previous Amount

- **File**: `src/nats/responders/payment-adjust.responder.ts:55-65`
- **Category**: bug
- **Impact**: Response contains incorrect previousAmount

**Description**

```typescript
return {
  paymentId: payment.id,
  previousAmount: payment.amount, // This is the NEW amount
  newAmount: payment.amount,
  adjustmentReason: reason,
};
```

Same issue as in trip-service - `previousAmount` is set to the current (new) amount.

**Recommendation**

The service should return the previous amount, or fetch before update:
```typescript
const previousAmount = existingPayment.amount;
const payment = await this.paymentsService.adjustPayment(...);
return {
  paymentId: payment.id,
  previousAmount,
  newAmount: payment.amount,
  adjustmentReason: reason,
};
```

---

### LOW FINDINGS

### LOW PAY-010: Missing Index for Refund Status

- **File**: `prisma/schema.prisma`
- **Category**: performance
- **Impact**: Slow queries when filtering refunds by status

**Description**

The Refund model has an index on `paymentId` but not on `status`:
```prisma
model Refund {
  // ...
  @@index([paymentId])
}
```

**Recommendation**

Add status index:
```prisma
@@index([status])
@@index([paymentId, status])
```

---

### LOW PAY-011: Currency Hardcoded to IQD

- **File**: `src/payments/payments.service.ts:20`
- **Category**: code-quality
- **Impact**: Cannot support multiple currencies

**Description**

```typescript
currency: 'IQD',
```

Currency is hardcoded. While this may be intentional for the Iraqi market, it limits future expansion.

**Recommendation**

Make currency configurable or accept from request:
```typescript
currency: data.currency || 'IQD',
```

---

### LOW PAY-012: Gateway Response Uses `any` Type

- **File**: `src/payments/payments.service.ts:37-40`
- **Category**: code-quality
- **Impact**: No type safety for gateway response data

**Description**

```typescript
gatewayResponse: { collectedBy, method: 'CASH' },
```

The `gatewayResponse` field is `Json?` in Prisma, meaning it's effectively `any`. No validation or typing.

**Recommendation**

Define a type for gateway responses:
```typescript
interface CashGatewayResponse {
  collectedBy: string;
  method: 'CASH';
  collectedAt: string;
}

// Use type assertion when saving
gatewayResponse: { collectedBy, method: 'CASH', collectedAt: new Date().toISOString() } as CashGatewayResponse,
```