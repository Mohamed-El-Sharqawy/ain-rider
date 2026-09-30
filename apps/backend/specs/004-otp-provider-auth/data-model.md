# Data Model: OTP Provider Authentication

## Entities

### OtpVerifiedEvent

Published to NATS when phone verification succeeds.

| Field       | Type   | Description                  |
| ----------- | ------ | ---------------------------- |
| phoneNumber | string | E.164 formatted phone number |
| uid         | string | Firebase Auth UID            |
| verifiedAt  | string | ISO 8601 timestamp           |

**NATS Subject**: `ain_rider.otp_verified`

```typescript
interface OtpVerifiedEvent {
  subject: typeof NATS_SUBJECTS.OTP_VERIFIED;
  data: {
    phoneNumber: string;
    uid: string;
    verifiedAt: string;
  };
}
```

### VerifyOtpRequest

API request body.

| Field   | Type   | Validation          |
| ------- | ------ | ------------------- |
| idToken | string | Required, non-empty |

```typescript
interface VerifyOtpRequest {
  idToken: string;
}
```

### VerifyOtpResponse

API response on success.

| Field       | Type    | Description     |
| ----------- | ------- | --------------- |
| success     | boolean | Always true     |
| phoneNumber | string  | E.164 formatted |
| uid         | string  | Firebase UID    |

```typescript
interface VerifyOtpResponse {
  success: true;
  phoneNumber: string;
  uid: string;
}
```

### ErrorResponse

API response on failure (follows constitution).

| Field         | Type    | Description            |
| ------------- | ------- | ---------------------- |
| success       | boolean | Always false           |
| error.code    | string  | Machine-readable code  |
| error.message | string  | Human-readable message |

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

## State Transitions

N/A - OTP verification is stateless. Each request is independent.

## Rate Limiting Keys

| Key Pattern                     | TTL   | Limit       |
| ------------------------------- | ----- | ----------- |
| `ratelimit:ip:{clientIp}`       | 60s   | 10 requests |
| `ratelimit:phone:{phoneNumber}` | 3600s | 5 requests  |

## Database Changes

No database schema changes required. This feature is purely event-driven.
