# Research: OTP Provider Authentication

## Research Questions

### Q1: How to implement provider abstraction for OTP?

**Decision**: Interface-based provider pattern with environment variable switching

**Rationale**:

- Allows easy testing without Firebase
- Production-ready with Firebase integration
- Simple configuration via `OTP_PROVIDER` env var

**Alternatives Considered**:

- Strategy pattern with DI - Rejected as over-engineering for 2 providers
- Direct Firebase integration only - Rejected due to dev/testing friction

### Q2: How to handle rate limiting for OTP verification?

**Decision**: Hybrid approach - IP limit (10/min) + phone limit (5/hour)

**Rationale**:

- IP-only allows distributed attacks from multiple IPs
- Phone-only doesn't protect against token stuffing from single attacker
- Hybrid covers both attack vectors

**Implementation**:

- Redis INCR with TTL for counters
- Keys: `ratelimit:ip:{ip}` (60s TTL), `ratelimit:phone:{phone}` (3600s TTL)

### Q3: Should Firebase ID tokens be single-use?

**Decision**: Allow replay within Firebase's validity window (~1hr)

**Rationale**:

- Firebase tokens are short-lived (1 hour default)
- Token only reveals user's own phone number (low security risk)
- Single-use tracking requires Redis storage for millions of tokens
- Rate limiting already prevents abuse
- Firebase handles token revocation for compromised accounts

**Alternatives Considered**:

- Single-use with Redis tracking - Rejected due to storage overhead vs minimal security benefit

### Q4: How to handle Firebase service unavailability?

**Decision**: Return 503 Service Unavailable with structured error

**Rationale**:

- Follows constitution principle III (unified response schema)
- 503 is semantically correct for upstream dependency failure
- Clients can implement retry with exponential backoff
- Ops team alerted via error logging

### Q5: Current vs Future provider implementation?

**Decision**: Simulated (console-based) for now, Firebase for production

**Rationale**:

- Dev environment doesn't need real SMS costs
- Console provider logs OTP for manual testing
- Same interface allows zero-code-change production switch
- `OTP_PROVIDER=console` for dev, `OTP_PROVIDER=firebase` for prod

## Dependencies

| Package        | Version | Purpose                        |
| -------------- | ------- | ------------------------------ |
| firebase-admin | Latest  | Firebase ID token verification |
| @nestjs/common | Latest  | DI, decorators                 |
| ioredis        | Latest  | Rate limiting counters         |

## Security Considerations

1. **Firebase credentials**: Never commit JSON file, use env vars
2. **Rate limiting**: Prevents brute force and token stuffing
3. **Token replay**: Acceptable within Firebase's short validity window
4. **Error messages**: Generic enough to not leak system info
