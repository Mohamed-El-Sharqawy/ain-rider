# Security Architecture - Ain Rider Dashboard

## Authentication Flow

### HTTP-Only Cookie Authentication

The dashboard uses **HTTP-only cookies** for JWT storage, providing defense-in-depth against XSS attacks.

#### Login Flow
```
1. User submits credentials → POST /auth/login
2. API Gateway validates with auth-service
3. Gateway sets TWO HTTP-only cookies:
   - accessToken (15 min TTL)
   - refreshToken (7 days TTL)
4. Dashboard receives user object (no token in response body)
5. Auth store saves user info only (no token storage)
```

#### Cookie Configuration
```typescript
{
  httpOnly: true,        // JavaScript cannot access (XSS protection)
  secure: true,          // HTTPS only in production
  sameSite: 'strict',    // CSRF protection
  path: '/',
  maxAge: 900            // 15 minutes for access token
}
```

#### Authenticated Requests
```
1. Browser automatically sends cookies with every request (withCredentials: true)
2. API Gateway reads accessToken from cookie
3. Gateway validates JWT and extracts user payload
4. Request proceeds with user context
```

#### Token Refresh
```
1. Background timer runs every 14 minutes
2. POST /auth/refresh (refreshToken sent automatically via cookie)
3. Gateway validates refresh token
4. Gateway issues new accessToken (sets cookie)
5. User session continues seamlessly
```

#### Logout Flow
```
1. User clicks logout → POST /auth/logout
2. Gateway clears both cookies (accessToken.remove(), refreshToken.remove())
3. Dashboard clears auth store
4. User redirected to /login
```

## Security Features

### 1. XSS Protection
- **No token in localStorage/sessionStorage** - Immune to XSS token theft
- **HTTP-only cookies** - JavaScript cannot access tokens
- **Content Security Policy** - Restrict inline scripts (recommended for production)

### 2. CSRF Protection
- **SameSite=Strict** - Cookies only sent to same-origin requests
- **CORS whitelist** - Only allowed origins can make requests
- **withCredentials** - Explicit opt-in for cross-origin cookies

### 3. Token Security
- **Dual-token architecture** - Separate access and refresh tokens with different lifetimes
- **Token type validation** - JWT payload includes `type: 'access' | 'refresh'` claim
- **Short-lived access tokens** - 15 minutes JWT expiration (limits damage if leaked)
- **Long-lived refresh tokens** - 7 days JWT expiration (better UX)
- **Cookie expiration alignment** - Cookie maxAge matches JWT exp claim
- **Access token**: `{ sub, email, role, type: 'access', exp: 15m }`
- **Refresh token**: `{ sub, email, role, type: 'refresh', exp: 7d }`
- **Type enforcement** - Access tokens rejected for refresh, refresh tokens rejected for API calls
- **Secure transmission** - HTTPS only in production

### 4. Session Management
- **Automatic refresh** - Tokens refreshed every 14 minutes
- **Graceful expiry** - User redirected to login on 401
- **Session restoration** - User info fetched on page load via /auth/me

### 5. Role-Based Access Control (RBAC)
- **Server-side enforcement** - JWT payload contains role
- **Client-side guards** - ProtectedRoute checks authentication
- **Admin-only dashboard** - Only ADMIN and SUPPORT roles allowed

## Attack Mitigation

| Attack Vector | Mitigation |
|---------------|------------|
| XSS (Cross-Site Scripting) | HTTP-only cookies, no token in JS |
| CSRF (Cross-Site Request Forgery) | SameSite=Strict, CORS whitelist |
| Token theft | Short-lived tokens, automatic rotation |
| Man-in-the-Middle | HTTPS only (secure flag in production) |
| Session hijacking | IP-based rate limiting, token expiry |
| Brute force | Rate limiting (100 req/min per IP) |

## Production Checklist

### Environment Variables
```bash
# API Gateway
NODE_ENV=production
JWT_SECRET=<strong-random-secret-256-bits>
CORS_ORIGIN=https://dashboard.ainrider.iq
API_GATEWAY_PORT=3000

# Dashboard
VITE_API_GATEWAY_URL=https://api.ainrider.iq
```

### Nginx/Reverse Proxy
```nginx
# Force HTTPS
server {
  listen 80;
  server_name dashboard.ainrider.iq;
  return 301 https://$server_name$request_uri;
}

server {
  listen 443 ssl http2;
  server_name dashboard.ainrider.iq;

  ssl_certificate /etc/ssl/certs/ainrider.crt;
  ssl_certificate_key /etc/ssl/private/ainrider.key;
  ssl_protocols TLSv1.2 TLSv1.3;
  ssl_ciphers HIGH:!aNULL:!MD5;

  # Security headers
  add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
  add_header X-Frame-Options "DENY" always;
  add_header X-Content-Type-Options "nosniff" always;
  add_header X-XSS-Protection "1; mode=block" always;
  add_header Referrer-Policy "strict-origin-when-cross-origin" always;

  location / {
    proxy_pass http://dashboard:5173;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://api-gateway:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### Content Security Policy (Recommended)
```html
<!-- Add to index.html -->
<meta http-equiv="Content-Security-Policy" 
      content="default-src 'self'; 
               script-src 'self'; 
               style-src 'self' 'unsafe-inline'; 
               img-src 'self' data: https:; 
               font-src 'self' data:; 
               connect-src 'self' https://api.ainrider.iq;">
```

## Monitoring & Alerts

### Key Metrics to Track
- Failed login attempts per IP (alert on >10/min)
- 401 responses (alert on spike)
- Token refresh failures (alert on >5% failure rate)
- Session duration (track p50, p95, p99)

### Prometheus Queries
```promql
# Failed logins
rate(http_requests_total{endpoint="/auth/login",status="401"}[5m])

# Token refresh failures
rate(http_requests_total{endpoint="/auth/refresh",status="401"}[5m])

# Active sessions
auth_active_sessions_total
```

## Compliance Notes

- **GDPR**: User data stored in EU-compliant on-premise infrastructure
- **PCI DSS**: Payment tokens never stored in cookies (handled by payment-service)
- **Audit Trail**: All auth events logged with structured JSON (userId, IP, timestamp)
- **Data Retention**: Refresh tokens expire after 7 days (configurable)

## Emergency Procedures

### Revoke All Sessions
```bash
# Rotate JWT secret (invalidates all tokens)
kubectl set env deployment/api-gateway JWT_SECRET=<new-secret>
kubectl rollout restart deployment/api-gateway
```

### Block Suspicious IP
```bash
# Add to rate limiter blacklist
redis-cli -c SET "ratelimit:blocked:1.2.3.4" "1" EX 86400
```

### Audit User Sessions
```bash
# Check active sessions in Redis
redis-cli -c KEYS "session:*"
redis-cli -c GET "session:user-id-here"
```

## References
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Elysia Cookie Plugin](https://elysiajs.com/plugins/cookie.html)
