# OTP_ARCHITECTURAL_DECISION.md
> Ain Rider — OTP Strategy · Dev & Production
 
---
 
## Decision
 
The backend owns OTP entirely. Mobile knows two endpoints only. The provider behind those endpoints is controlled by a single environment variable. Swapping providers requires no mobile changes and no endpoint changes.
 
---
 
## Endpoints (permanent, never change)
 
```
POST /auth/request-otp   { phone }
POST /auth/verify-otp    { phone, code }
```
 
---
 
## Responsibilities
 
**OTP Service** — owns these regardless of active provider:
- 6-digit code generation
- Redis storage with 5-minute TTL
- Single-use enforcement (delete on successful verify)
- Publish `ain_rider.otp_verified` to NATS JetStream on success
 
**OTP Provider** — owns only:
- `send(phone, code)` — delivery mechanism
- `verify(phone, code)` — verification logic (dev: Redis · prod: provider SDK)
 
---
 
## Environments
 
### Development
```
OTP_PROVIDER=console
```
- Code generated and stored in Redis
- Code logged to terminal — developer reads it and types it into the mobile app
- Verification checks against Redis
- No external service, no cost, no setup
 
### Production
```
OTP_PROVIDER=firebase   # or twilio / infobip / unifonic
```
- Code sent via SMS to real phone
- Provider manages delivery, retry, and carrier routing
- Redis TTL and single-use rules remain active as a safety net
- Preferred provider: **Firebase Auth** (free tier, no sender ID registration required for Iraq/Egypt)
- Fallback if delivery rates are insufficient: **Infobip** or **Unifonic** (better Middle East carrier coverage, requires sender ID approval per country)
 
---
 
## NATS Role
 
`ain_rider.otp_verified` is published after every successful verification in both environments. Downstream consumers (driver record initialization, welcome notification, analytics) subscribe to this event. They are fully decoupled from the OTP provider — they don't know and don't care what delivered the SMS.
 
---
 
## Mobile Contract
 
One hook. Two calls. Provider-agnostic forever.
 
```
requestOtp(phone)      →  POST /auth/request-otp
verifyOtp(phone, code) →  POST /auth/verify-otp
```
 
No SMS SDK on the mobile side. No Firebase Auth SDK. No Twilio SDK. If the backend switches providers, mobile ships nothing.
 
---
 
## Switching to Production — Process
 
1. Implement new provider class against the existing `OtpProvider` interface (`send` + `verify`)
2. Register it in the provider factory (one line)
3. Add provider credentials to environment secrets — never in code
4. Deploy to staging, test real SMS delivery to Iraq (+964) and Egypt (+20) numbers
5. Confirm `ain_rider.otp_verified` flows through NATS end to end
6. Set `OTP_PROVIDER=firebase` in production environment
7. Monitor delivery rates and error logs for 30 minutes post-switch
 
**Rollback:** Set `OTP_PROVIDER=console`, redeploy. No data loss. Redis TTLs expire naturally.
 
---
 
## What Never Changes on Provider Swap
 
- Both endpoints
- OTP Service layer
- Redis TTL and single-use rules
- NATS event and all downstream consumers
- Mobile app
- Registration flow post-verification
 
## What Changes
 
- One new provider file
- One line in the provider factory
- One environment variable value