# API Gateway Code Review

**Workspace**: backend
**Domain**: api-gateway
**Date**: 2026-04-07
**Files Reviewed**: 22 files

## Summary

The API Gateway is well-structured with proper separation of concerns (modules, services, models, shared utilities). Error handling uses the shared `@ain-rider/error-handling` package consistently. However, there are several security concerns around hardcoded secrets, missing validation, and unauthenticated metrics endpoints. The rate limiting implementation is vulnerable to header spoofing, and some proxy routes lack proper body validation.

## Files Covered

| File | Status | Findings |
|------|--------|----------|
| `src/index.ts` | Issues found | 2 high, 1 medium |
| `src/modules/auth/guard.ts` | Issues found | 1 critical, 1 medium |
| `src/modules/auth/index.ts` | Issues found | 1 high, 2 medium |
| `src/modules/auth/model.ts` | Clean | 0 |
| `src/modules/auth/service.ts` | Clean | 0 |
| `src/modules/admin/index.ts` | Issues found | 2 high, 1 medium |
| `src/modules/admin/service.ts` | Clean | 0 |
| `src/modules/health/index.ts` | Clean | 0 |
| `src/modules/location/index.ts` | Issues found | 1 medium |
| `src/modules/location/service.ts` | Clean | 0 |
| `src/modules/match/index.ts` | Issues found | 1 medium |
| `src/modules/match/service.ts` | Clean | 0 |
| `src/modules/metrics/dashboard.ts` | Issues found | 1 high |
| `src/modules/metrics/index.ts` | Clean | 0 |
| `src/modules/metrics/proxy.ts` | Issues found | 1 high |
| `src/modules/settings/index.ts` | Clean | 0 |
| `src/modules/support/index.ts` | Issues found | 1 medium, 1 low |
| `src/modules/trips/index.ts` | Issues found | 1 medium |
| `src/modules/trips/model.ts` | Issues found | 1 low |
| `src/modules/trips/service.ts` | Clean | 0 |
| `src/shared/error-handler.ts` | Clean | 0 |
| `src/shared/logger.ts` | Clean | 0 |
| `src/shared/redis.ts` | Issues found | 1 low |
| `src/shared/trace.ts` | Clean | 0 |

---

### CRITICAL FINDINGS

### CRITICAL BGW-001: JWT Secret Has Hardcoded Fallback

- **File**: `src/modules/auth/guard.ts:10`
- **Category**: security
- **Impact**: Production deployments may use weak default secret, allowing token forgery

**Description**

The JWT secret has a hardcoded fallback value:
```typescript
secret: process.env.JWT_SECRET || "change-me-in-production",
```

If `JWT_SECRET` environment variable is not set, the application silently uses a known default value. An attacker could forge valid JWT tokens using this secret.

**Recommendation**

Remove the fallback and fail fast on startup if the secret is not configured:
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
// Then use: secret: JWT_SECRET
```

---

### HIGH FINDINGS

### HIGH BGW-002: Internal Service Secret Has Hardcoded Fallback

- **File**: `src/modules/admin/index.ts:7`
- **Category**: security
- **Impact**: Internal service authentication can be bypassed with known default

**Description**

Same issue as BGW-001. The internal service secret has a predictable fallback:
```typescript
const INTERNAL_SECRET = process.env.INTERNAL_SERVICE_SECRET || 'dev-internal-secret-987654321';
```

This secret is used to sign internal JWT tokens for service-to-service communication. A known secret allows attackers to forge internal tokens.

**Recommendation**

Fail fast on startup if `INTERNAL_SERVICE_SECRET` is not set. Never use a fallback in production code.

---

### HIGH BGW-003: Rate Limiting Vulnerable to IP Spoofing

- **File**: `src/index.ts:80-84`
- **Category**: security
- **Impact**: Attackers can bypass rate limits by spoofing X-Forwarded-For header

**Description**

Rate limiting uses client IP from headers without validation:
```typescript
generator: (req) =>
  req.headers.get("x-forwarded-for") ||
  req.headers.get("x-real-ip") ||
  "anonymous",
```

An attacker can send requests with arbitrary `X-Forwarded-For` values to bypass rate limits entirely.

**Recommendation**

1. Trust only the last IP in `X-Forwarded-For` chain (set by your reverse proxy)
2. Validate that requests come through your reverse proxy
3. Consider using a signed header from your reverse proxy (e.g., Cloudflare's `CF-Connecting-IP`)

```typescript
generator: (req) => {
  // If behind a trusted reverse proxy, use the rightmost X-Forwarded-For
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const ips = forwarded.split(',').map(ip => ip.trim());
    return ips[ips.length - 1]; // Rightmost = set by reverse proxy
  }
  return req.headers.get("x-real-ip") || "anonymous";
}
```

---

### HIGH BGW-004: Metrics Endpoint Exposes Internal Service Data Without Auth

- **File**: `src/modules/metrics/proxy.ts:20-35`
- **Category**: security
- **Impact**: Internal service metrics and topology exposed to unauthenticated users

**Description**

The `/:service/metrics` endpoint proxies to internal services without authentication:
```typescript
export const metricsProxy = new Elysia()
  .get('/:service/metrics', async ({ params, set }) => {
    // No auth guard!
    const targetUrl = SERVICE_MAP[params.service];
    // ...
  });
```

Anyone can access `/auth/metrics`, `/trips/metrics`, etc. to see internal metrics, error rates, and service topology.

**Recommendation**

Add authentication to the metrics endpoints:
```typescript
export const metricsProxy = new Elysia()
  .use(authGuard) // Require authentication
  .get('/:service/metrics', async ({ params, set, user }) => {
    // Optionally restrict to admin role
    if (user.role !== 'ADMIN') {
      set.status = 403;
      return { error: 'Forbidden' };
    }
    // ...
  });
```

---

### HIGH BGW-005: Admin Proxy Wildcard Route Lacks Validation

- **File**: `src/modules/admin/index.ts:15-60`
- **Category**: security
- **Impact**: Any authenticated user could potentially access admin routes if role check is bypassed

**Description**

The admin module uses a wildcard `.all('/*')` route that proxies everything under `/admin/*`:
```typescript
export const admin = new Elysia({ prefix: '/admin' })
  .use(authGuard)
  .all('/*', async ({ request, accessToken, user, set, internalJwt }) => {
    // Only authGuard checks authentication, but no explicit role check here
    // The authGuard only verifies JWT validity, not role
  });
```

While `authGuard` verifies the JWT, it doesn't restrict by role. The admin service downstream checks roles, but defense-in-depth suggests the gateway should also validate.

**Recommendation**

Add explicit role check at the gateway level:
```typescript
.use(authGuard)
.all('/*', async ({ user, set, ... }) => {
  if (user.role !== 'ADMIN' && user.role !== 'SUPPORT') {
    set.status = 403;
    return { error: 'Forbidden: Admin access required' };
  }
  // ...
});
```

---

### MEDIUM FINDINGS

### MEDIUM BGW-006: Multipart Upload Size Check Uses Untrusted Header

- **File**: `src/modules/auth/index.ts:180-182`
- **Category**: security
- **Impact**: Content-Length header can be spoofed; actual body may be larger

**Description**

File upload size validation uses the `Content-Length` header:
```typescript
const contentLength = parseInt(request.headers.get("content-length") || "0");
if (contentLength > 10 * 1024 * 1024) {
  throw status(413, "Request too large. Maximum total size is 10MB");
}
```

This header is sent by the client and can be falsified. The actual body size is only checked after reading into memory.

**Recommendation**

Use streaming with size limits instead of reading the entire body first, or validate actual `rawBody.byteLength` after reading:
```typescript
const rawBody = await request.arrayBuffer();
if (rawBody.byteLength > 10 * 1024 * 1024) {
  throw status(413, "Request too large");
}
```

---

### MEDIUM BGW-007: Trip Status Update Uses String Instead of Enum

- **File**: `src/modules/trips/model.ts:15-17`
- **Category**: bug
- **Impact**: Invalid status strings accepted, may cause downstream errors

**Description**

Status update body uses generic string instead of enum:
```typescript
statusUpdateBody: t.Object({
  status: t.String(),
}),
```

This allows any string value for status, but trip-service likely expects specific values (e.g., 'ARRIVED', 'IN_PROGRESS', 'COMPLETED').

**Recommendation**

Use union of literal types matching the trip state machine:
```typescript
statusUpdateBody: t.Object({
  status: t.Union([
    t.Literal('ARRIVED'),
    t.Literal('IN_PROGRESS'),
    t.Literal('COMPLETED'),
  ]),
}),
```

---

### MEDIUM BGW-008: Location Query Params Lack NaN Validation

- **File**: `src/modules/location/index.ts:10-12`
- **Category**: edge-case
- **Impact**: Invalid coordinates produce NaN, passed to downstream service

**Description**

Query parameters are parsed without validation:
```typescript
const res = await LocationProxyService.getNearbyDrivers(
  parseFloat(query.latitude),
  parseFloat(query.longitude),
);
```

If `query.latitude` is not a valid number string, `parseFloat` returns `NaN`, which is passed to the location service.

**Recommendation**

Validate parsed values:
```typescript
const lat = parseFloat(query.latitude);
const lng = parseFloat(query.longitude);
if (isNaN(lat) || isNaN(lng)) {
  set.status = 400;
  return { error: 'Invalid latitude or longitude' };
}
```

---

### MEDIUM BGW-009: Match Nearby Query Lacks NaN Validation

- **File**: `src/modules/match/index.ts:60-62`
- **Category**: edge-case
- **Impact**: Same as BGW-008

**Description**

Same issue as BGW-008 in match module:
```typescript
const lat = parseFloat(query.latitude as string);
const lng = parseFloat(query.longitude as string);
```

**Recommendation**

Add NaN validation as in BGW-008.

---

### MEDIUM BGW-010: Support Module Body Has Implicit Any Type

- **File**: `src/modules/support/index.ts:65-75`
- **Category**: code-quality
- **Impact**: No compile-time type safety for request bodies

**Description**

Support routes use `body` without type annotation:
```typescript
.post('/complaints', async ({ user, set, internalJwt, body }) => {
  // body is implicitly 'any'
  const { status, data } = await proxyToAdminService(
    'POST',
    '/complaints/public',
    internalToken,
    body, // No validation
  );
```

No validation schema is provided, allowing malformed requests.

**Recommendation**

Add body validation schema:
```typescript
.post('/complaints', async ({ body, ... }) => {
  // ...
}, {
  body: t.Object({
    subject: t.String(),
    description: t.String(),
    category: t.Optional(t.String()),
  }),
})
```

---

### MEDIUM BGW-011: Cookie SameSite Could Be Stricter for Mobile

- **File**: `src/modules/auth/index.ts:7-8`
- **Category**: security
- **Impact**: Cookies potentially vulnerable to CSRF in certain scenarios

**Description**

SameSite is set to 'lax' in development:
```typescript
const SAME_SITE = isProduction ? "strict" : "lax";
```

Mobile clients don't use cookies (tokens in body), but dashboard does. 'lax' in development could allow CSRF during local testing.

**Recommendation**

For dashboard clients, consider always using 'strict' or 'none' with Secure flag. For mobile clients, don't set cookies at all (already handled via `isMobileClient` check).

---

### LOW FINDINGS

### LOW BGW-012: Redis Cluster Imported But Unused

- **File**: `src/shared/redis.ts`
- **Category**: code-quality
- **Impact**: Dead code, unnecessary memory allocation

**Description**

Redis cluster and cache are exported but never imported or used in any route:
```typescript
export const redisCluster = createRedisCluster({ ... });
export const cache = createCache(redisCluster);
```

The health check uses `redisCluster.ping()`, but the cache is never used.

**Recommendation**

Either implement caching or remove unused exports to reduce bundle size.

---

### LOW BGW-013: Trace Middleware Duplicated

- **File**: `src/index.ts:42-47` and `src/shared/trace.ts`
- **Category**: code-quality
- **Impact**: Redundant code, potential confusion

**Description**

Trace logic is implemented inline in `index.ts`:
```typescript
.onRequest(({ request, store }) => {
  const headers = request.headers as unknown as Record<string, string>;
  const traceId = extractTraceId(headers) || generateTraceId();
  store.traceId = traceId;
})
```

But a separate `traceMiddleware` plugin exists in `src/shared/trace.ts` using `onTransform` instead of `onRequest`.

**Recommendation**

Use the centralized `traceMiddleware` from `src/shared/trace.ts` and remove inline implementation.

---

### LOW BGW-014: Error Response Inconsistency in Proxy Routes

- **File**: Multiple files in `src/modules/*/index.ts`
- **Category**: code-quality
- **Impact**: Inconsistent error format across routes

**Description**

Most proxy routes use this pattern for error handling:
```typescript
if (!res.ok) {
  try {
    const errorBody = await res.json();
    set.status = res.status;
    return errorBody;
  } catch {
    set.status = res.status;
    return { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to parse error response' } };
  }
}
```

This is repeated 20+ times across files. The fallback error format differs from the structured error contract.

**Recommendation**

Extract a helper function:
```typescript
async function handleProxyError(res: Response, set: any) {
  set.status = res.status;
  try {
    return await res.json();
  } catch {
    return { success: false, error: { code: 'PROXY_ERROR', message: `Upstream error: ${res.statusText}` } };
  }
}
```