# API Contract: Auth Routes

**Feature**: 003-mobile-token-auth
**Date**: 2026-03-26

## Overview

This document defines the modified API contract for authentication endpoints to support mobile token authentication.

## Headers

| Header        | Required    | Values           | Purpose                                                |
| ------------- | ----------- | ---------------- | ------------------------------------------------------ |
| X-Client-Type | No          | `mobile`         | Signals mobile client; triggers token-in-body response |
| Authorization | Conditional | `Bearer <token>` | Alternative to cookie for token passing                |

## Endpoints

### POST /auth/login

Authenticates user and returns tokens.

**Request**:

```typescript
{
  email: string; // Required, valid email format
  password: string; // Required, min 8 characters
}
```

**Response (Web - no X-Client-Type header)**:

```typescript
{
  success: true;
  user: {
    id: string;
    email: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    role: "RIDER" | "DRIVER" | "ADMIN" | "SUPPORT";
    status: string;
  }
}
// Cookies set: accessToken (15 min), refreshToken (7 days)
```

**Response (Mobile - X-Client-Type: mobile)**:

```typescript
{
  success: true;
  user: {
    id: string;
    email: string;
    phoneNumber: string;
    firstName: string;
    lastName: string;
    role: "RIDER" | "DRIVER" | "ADMIN" | "SUPPORT";
    status: string;
  }
  accessToken: string; // JWT, 15 min expiry
  refreshToken: string; // JWT, 7 day expiry
}
// Cookies ALSO set (for potential webview fallback)
```

**Error Responses**:

```typescript
// 401 Unauthorized
{
  success: false;
  error: {
    code: "INVALID_CREDENTIALS";
    message: "Invalid email or password";
  }
}

// 400 Bad Request
{
  success: false;
  error: {
    code: "VALIDATION_ERROR";
    message: "Email is required";
  }
}
```

---

### POST /auth/register

Creates new user account and returns tokens.

**Request**:

```typescript
{
  email: string;
  password: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: "RIDER" | "DRIVER";
}
```

**Response (Web)**:

```typescript
{
  success: true;
  user: {
    /* User object */
  }
}
// Cookies set
```

**Response (Mobile - X-Client-Type: mobile)**:

```typescript
{
  success: true;
  user: {
    /* User object */
  }
  accessToken: string;
  refreshToken: string;
}
// Cookies ALSO set
```

**Error Responses**:

```typescript
// 409 Conflict
{
  success: false;
  error: {
    code: "EMAIL_EXISTS";
    message: "Email already registered";
  }
}
```

---

### POST /auth/refresh

Refreshes access token using refresh token.

**Token Resolution Order**:

1. Authorization: Bearer `<refresh-token>` header
2. refreshToken cookie

**Request**: No body required

**Response (Web)**:

```typescript
{
  success: true;
}
// New accessToken cookie set
```

**Response (Mobile - X-Client-Type: mobile)**:

```typescript
{
  success: true;
  accessToken: string; // New access token
  refreshToken: string; // New refresh token (rotated)
}
```

**Error Responses**:

```typescript
// 401 Unauthorized - Expired token
{
  success: false;
  error: {
    code: "TOKEN_EXPIRED";
    message: "Refresh token has expired";
  }
}

// 401 Unauthorized - Invalid/Revoked token
{
  success: false;
  error: {
    code: "TOKEN_REVOKED";
    message: "Token has been revoked";
  }
}

// 401 Unauthorized - No token
{
  success: false;
  error: {
    code: "UNAUTHORIZED";
    message: "No refresh token provided";
  }
}
```

---

### GET /auth/me

Returns current authenticated user.

**Token Resolution Order**:

1. Authorization: Bearer `<access-token>` header
2. accessToken cookie

**Request**: No body required

**Response**:

```typescript
{
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: "RIDER" | "DRIVER" | "ADMIN" | "SUPPORT";
  status: string;
  profileImage?: string;
  createdAt: string;
}
```

**Error Responses**:

```typescript
// 401 Unauthorized - Expired token
{
  success: false;
  error: {
    code: "TOKEN_EXPIRED";
    message: "Access token has expired";
  }
}

// 401 Unauthorized - Invalid/No token
{
  success: false;
  error: {
    code: "UNAUTHORIZED";
    message: "Not authenticated";
  }
}
```

---

### POST /auth/logout

Clears authentication tokens.

**Request**: No body required

**Response**:

```typescript
{
  success: true;
}
// Cookies cleared
```

## Token Structure

### Access Token (JWT)

```typescript
{
  sub: string; // User ID
  email: string;
  role: string;
  type: "access";
  iat: number;
  exp: number; // 15 minutes from iat
}
```

### Refresh Token (JWT)

```typescript
{
  sub: string; // User ID
  email: string;
  role: string;
  type: "refresh";
  family: string; // UUID for rotation tracking
  iat: number;
  exp: number; // 7 days from iat
}
```

## Backward Compatibility

All existing web client behavior is preserved:

- Web clients without X-Client-Type header receive cookies only
- Web clients continue to use cookie-based authentication
- No changes required to existing web frontend
