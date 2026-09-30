# Quickstart: Mobile Token Authentication

**Feature**: 003-mobile-token-auth
**Date**: 2026-03-26

## Prerequisites

- Backend services running (api-gateway:3000, auth-service:4000)
- PostgreSQL with ainrider_auth database
- Test user account or ability to register

## Testing Scenarios

### 1. Web Login (Backward Compatibility)

Verify existing web behavior is unchanged.

```bash
# Login without mobile header
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  -c cookies.txt \
  -v

# Expected:
# - Response body: { "success": true, "user": {...} }
# - NO tokens in body
# - Set-Cookie headers for accessToken and refreshToken
```

### 2. Mobile Login

Verify mobile clients receive tokens in body.

```bash
# Login with mobile header
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: mobile" \
  -d '{"email": "test@example.com", "password": "password123"}' \
  -v

# Expected:
# - Response body: { "success": true, "user": {...}, "accessToken": "...", "refreshToken": "..." }
# - ALSO Set-Cookie headers (for webview fallback)
```

### 3. Mobile Register

```bash
# Register with mobile header
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: mobile" \
  -d '{
    "email": "newuser@example.com",
    "password": "password123",
    "phoneNumber": "+1234567890",
    "firstName": "Test",
    "lastName": "User",
    "role": "RIDER"
  }'

# Expected:
# - Response body: { "success": true, "user": {...}, "accessToken": "...", "refreshToken": "..." }
```

### 4. Access Protected Route with Bearer Token

```bash
# Store access token from login response
ACCESS_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Access /auth/me with Bearer header
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"

# Expected:
# - Response body: { "id": "...", "email": "...", ... }
# - Status: 200
```

### 5. Access Protected Route with Cookie (Web Fallback)

```bash
# Use cookies from web login
curl http://localhost:3000/auth/me \
  -b cookies.txt

# Expected:
# - Response body: { "id": "...", "email": "...", ... }
# - Status: 200
```

### 6. Token Refresh with Bearer

```bash
# Store refresh token from login response
REFRESH_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Refresh with Bearer header
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN" \
  -H "X-Client-Type: mobile"

# Expected:
# - Response body: { "success": true, "accessToken": "...", "refreshToken": "..." }
# - New tokens (old refresh token is now revoked)
```

### 7. Token Refresh with Cookie

```bash
# Refresh using cookie
curl -X POST http://localhost:3000/auth/refresh \
  -b cookies.txt

# Expected:
# - Response body: { "success": true }
# - New accessToken cookie set
```

### 8. Expired Token Error

```bash
# Use an expired access token
curl http://localhost:3000/auth/me \
  -H "Authorization: Bearer expired_token_here"

# Expected:
# - Status: 401
# - Response body: { "success": false, "error": { "code": "TOKEN_EXPIRED", "message": "..." } }
```

### 9. Missing Token Error

```bash
# Access protected route without token
curl http://localhost:3000/auth/me

# Expected:
# - Status: 401
# - Response body: { "success": false, "error": { "code": "UNAUTHORIZED", "message": "..." } }
```

### 10. Token Reuse Detection

```bash
# 1. Login and get tokens
RESPONSE=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Client-Type: mobile" \
  -d '{"email": "test@example.com", "password": "password123"}')

REFRESH_TOKEN=$(echo $RESPONSE | jq -r '.refreshToken')

# 2. Refresh to get new tokens
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN" \
  -H "X-Client-Type: mobile"

# 3. Try to use OLD refresh token again (should fail)
curl -X POST http://localhost:3000/auth/refresh \
  -H "Authorization: Bearer $REFRESH_TOKEN" \
  -H "X-Client-Type: mobile"

# Expected:
# - Status: 401
# - Response body: { "success": false, "error": { "code": "TOKEN_REVOKED", "message": "..." } }
# - All tokens in family revoked (user must re-login)
```

## Mobile Client Integration

### React Native Example

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_URL = "http://localhost:3000";

async function login(email: string, password: string) {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Client-Type": "mobile",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (data.success) {
    // Store tokens securely
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    await AsyncStorage.setItem("user", JSON.stringify(data.user));
  }

  return data;
}

async function authenticatedRequest(
  endpoint: string,
  options: RequestInit = {},
) {
  const accessToken = await AsyncStorage.getItem("accessToken");

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 401) {
    const error = await response.json();
    if (error.error.code === "TOKEN_EXPIRED") {
      // Attempt refresh
      const refreshed = await refreshTokens();
      if (refreshed) {
        // Retry request with new token
        return authenticatedRequest(endpoint, options);
      }
    }
    // Redirect to login
  }

  return response;
}

async function refreshTokens(): Promise<boolean> {
  const refreshToken = await AsyncStorage.getItem("refreshToken");

  const response = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${refreshToken}`,
      "X-Client-Type": "mobile",
    },
  });

  if (response.ok) {
    const data = await response.json();
    await AsyncStorage.setItem("accessToken", data.accessToken);
    await AsyncStorage.setItem("refreshToken", data.refreshToken);
    return true;
  }

  // Refresh failed - user must re-login
  await AsyncStorage.multiRemove(["accessToken", "refreshToken", "user"]);
  return false;
}
```

## Verification Checklist

- [ ] Web login returns cookies only, no tokens in body
- [ ] Mobile login returns tokens in body AND sets cookies
- [ ] Mobile register returns tokens in body
- [ ] Protected routes accept Bearer token
- [ ] Protected routes accept cookie (fallback)
- [ ] Refresh accepts Bearer refresh token
- [ ] Refresh accepts cookie (fallback)
- [ ] Mobile refresh returns new tokens in body
- [ ] Expired token returns TOKEN_EXPIRED error
- [ ] Missing token returns UNAUTHORIZED error
- [ ] Token rotation works (old token revoked after refresh)
- [ ] Reuse detection revokes token family
