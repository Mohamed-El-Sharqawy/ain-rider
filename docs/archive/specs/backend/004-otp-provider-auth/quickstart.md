# Quickstart: OTP Provider Authentication

## Prerequisites

- Docker and Docker Compose running
- `pnpm` installed
- Environment variables configured

## Environment Variables

Add to `apps/nest/auth-service/.env`:

```env
# OTP Provider (console for dev, firebase for prod)
OTP_PROVIDER=console

# Firebase (required for prod, optional for dev)
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

## Running the Service

```bash
# Start infrastructure
docker compose up -d

# Start auth-service
cd apps/nest/auth-service
pnpm dev

# Start api-gateway (in another terminal)
cd apps/elysia/api-gateway
pnpm dev
```

## Testing the Endpoint

### Development Mode (Console Provider)

```bash
curl -X POST http://localhost:3000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"idToken": "test-token"}'
```

Expected response:

```json
{
  "success": true,
  "phoneNumber": "+1234567890",
  "uid": "test-uid"
}
```

### With Firebase (Production)

1. Client app uses Firebase SDK to verify phone OTP
2. Client sends resulting ID token to `/auth/verify-otp`
3. Server verifies token with Firebase Admin SDK

## NATS Event

On successful verification, `otp_verified` event is published:

```json
{
  "subject": "ain_rider.otp_verified",
  "data": {
    "phoneNumber": "+201001234567",
    "uid": "abc123def456",
    "verifiedAt": "2026-03-27T10:00:00.000Z"
  }
}
```

## Downstream Service Integration

Subscribe to `ain_rider.otp_verified` to:

- Auto-create user accounts
- Link phone to existing users
- Send welcome notifications

```typescript
// Example consumer
consumer.subscribe(NATS_SUBJECTS.OTP_VERIFIED, async (data) => {
  const { phoneNumber, uid } = data;
  // Check if user exists with this phone
  // Create user if needed
  // Link Firebase UID to user record
});
```

## Rate Limiting

- **Per IP**: 10 requests per minute
- **Per Phone**: 5 requests per hour

Exceeded limits return HTTP 429 with `Retry-After` header.
