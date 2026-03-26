# 911 Ain Rider — Mobile API Endpoints Reference

Complete API reference for the mobile app. All REST endpoints go through the **API Gateway** (`api-gateway:3000`).
Real-time events come via the **WebSocket Server** (`websocket-server:3001`).

> **Base URLs**
> - REST API: `https://api.ainrider.com` (prod) / `http://localhost:3000` (dev)
> - WebSocket: `wss://api.ainrider.com/ws` (prod) / `ws://localhost:3001/ws` (dev)

---

## Table of Contents

1. [Authentication Endpoints](#1-authentication-endpoints)
2. [User Profile Endpoints](#2-user-profile-endpoints)
3. [Trip Endpoints](#3-trip-endpoints)
4. [Location Endpoints](#4-location-endpoints)
5. [Match Endpoints (Driver)](#5-match-endpoints-driver)
6. [Payment Endpoints](#6-payment-endpoints)
7. [Notification Endpoints](#7-notification-endpoints)
8. [Support & Safety Endpoints](#8-support--safety-endpoints)
9. [Promo Code Endpoints](#9-promo-code-endpoints)
10. [WebSocket Events](#10-websocket-events)
11. [Scalability Notes for 1M+ Users](#11-scalability-notes-for-1m-users)
12. [Error Response Format](#12-error-response-format)

---

## 1. Authentication Endpoints

### `POST /auth/register`
Register a new user (rider or driver).

```
Request:
{
  "email": "user@example.com",
  "password": "StrongP@ss1",
  "phoneNumber": "+9647701234567",
  "firstName": "Ali",
  "lastName": "Hassan",
  "role": "RIDER"              // "RIDER" | "DRIVER"
}

Response 201:
{
  "success": true,
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phoneNumber": "+9647701234567",
    "firstName": "Ali",
    "lastName": "Hassan",
    "role": "RIDER",
    "status": "ACTIVE"
  },
  "accessToken": "eyJhbG...",    // For mobile clients
  "refreshToken": "eyJhbG..."   // For mobile clients
}
```

**Mobile Note**: Backend currently sets `httpOnly` cookies. For mobile, tokens should also be returned in the response body. If not available, a mobile-specific endpoint may be needed.

---

### `POST /auth/login`
Authenticate an existing user.

```
Request:
{
  "email": "user@example.com",
  "password": "StrongP@ss1"
}

Response 200:
{
  "success": true,
  "user": { ... },
  "accessToken": "eyJhbG...",
  "refreshToken": "eyJhbG..."
}

Response 401:
{
  "success": false,
  "error": "Invalid credentials"
}
```

---

### `POST /auth/refresh`
Refresh an expired access token.

```
Request:
Headers: { "Authorization": "Bearer <refreshToken>" }
// OR send refreshToken in body for mobile

Response 200:
{
  "success": true,
  "accessToken": "eyJhbG..."
}
```

---

### `POST /auth/logout`
Invalidate the current session.

```
Response 200:
{
  "success": true
}
```

---

### `POST /auth/device-token` *(Needed — may require backend addition)*
Register FCM/APNs push notification token.

```
Request:
{
  "token": "fcm_device_token_here",
  "platform": "android"         // "android" | "ios"
}

Response 200:
{
  "success": true
}
```

---

## 2. User Profile Endpoints

### `GET /auth/me`
Get current authenticated user profile.

```
Headers: { "Authorization": "Bearer <accessToken>" }

Response 200:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "phoneNumber": "+9647701234567",
    "firstName": "Ali",
    "lastName": "Hassan",
    "role": "RIDER",
    "status": "ACTIVE",
    "profileImage": "https://minio.ainrider.com/ain-rider/profiles/uuid.jpg",
    "createdAt": "2026-01-15T10:00:00Z"
  }
}
```

---

### `PATCH /auth/me` *(Needed — may require backend addition)*
Update user profile.

```
Request:
{
  "firstName": "Ali",
  "lastName": "Hassan",
  "phoneNumber": "+9647701234567"
}

Response 200:
{
  "success": true,
  "user": { ... }
}
```

---

### `POST /auth/me/avatar` *(Needed — may require backend addition)*
Upload profile image.

```
Request: multipart/form-data
  file: <image binary>

Response 200:
{
  "success": true,
  "profileImage": "https://minio.ainrider.com/ain-rider/profiles/uuid.jpg"
}
```

---

### `GET /auth/me/driver` *(Needed for driver role — may require backend addition)*
Get driver-specific data (vehicle, license, rating).

```
Response 200:
{
  "driver": {
    "id": "uuid",
    "userId": "uuid",
    "vehicleId": "uuid",
    "licenseNumber": "B12345",
    "rating": 4.8,
    "totalTrips": 1250,
    "isOnline": true
  }
}
```

---

### `GET /auth/me/rider` *(Needed for rider role — may require backend addition)*
Get rider-specific data.

```
Response 200:
{
  "rider": {
    "id": "uuid",
    "userId": "uuid",
    "rating": 4.9,
    "totalTrips": 87
  }
}
```

---

## 3. Trip Endpoints

### `POST /trips`
Request a new trip (rider only).

```
Request:
{
  "riderId": "rider-uuid",
  "pickupLat": 33.3152,
  "pickupLng": 44.3661,
  "pickupAddress": "Karrada, Baghdad",
  "dropoffLat": 33.2950,
  "dropoffLng": 44.3773,
  "dropoffAddress": "Mansour, Baghdad",
  "estimatedFare": 15000,           // In IQD
  "paymentMethod": "CASH",          // "CASH" | "CARD" | "WALLET"
  "promoCode": "RIDE50"             // Optional
}

Response 201:
{
  "trip": {
    "id": "trip-uuid",
    "riderId": "rider-uuid",
    "driverId": null,
    "status": "REQUESTED",
    "pickupLat": 33.3152,
    "pickupLng": 44.3661,
    "pickupAddress": "Karrada, Baghdad",
    "dropoffLat": 33.2950,
    "dropoffLng": 44.3773,
    "dropoffAddress": "Mansour, Baghdad",
    "estimatedFare": 15000,
    "actualFare": null,
    "paymentMethod": "CASH",
    "paymentStatus": "PENDING",
    "promoCode": "RIDE50",
    "promoDiscount": 2500,
    "requestedAt": "2026-03-26T10:00:00Z"
  }
}
```

Backend Side Effects: Publishes `ain_rider.trip_requested` → match-service searches for nearby drivers.

---

### `GET /trips/:id`
Get trip details.

```
Response 200:
{
  "trip": {
    "id": "trip-uuid",
    "riderId": "rider-uuid",
    "driverId": "driver-uuid",
    "status": "MATCHED",
    "pickupLat": 33.3152,
    "pickupLng": 44.3661,
    "pickupAddress": "Karrada, Baghdad",
    "dropoffLat": 33.2950,
    "dropoffLng": 44.3773,
    "dropoffAddress": "Mansour, Baghdad",
    "estimatedFare": 15000,
    "actualFare": null,
    "paymentMethod": "CASH",
    "paymentStatus": "PENDING",
    "distance": null,
    "duration": null,
    "requestedAt": "2026-03-26T10:00:00Z",
    "matchedAt": "2026-03-26T10:00:05Z",
    "startedAt": null,
    "completedAt": null,
    "driverRating": null,
    "riderRating": null
  }
}
```

---

### `PATCH /trips/:id/cancel`
Cancel a trip (by rider or driver).

```
Request:
{
  "reason": "Changed my mind",
  "cancelledBy": "rider-uuid"      // User ID of who cancelled
}

Response 200:
{
  "trip": {
    ...
    "status": "CANCELLED",
    "cancelledAt": "2026-03-26T10:01:00Z",
    "cancellationReason": "Changed my mind",
    "cancelledBy": "rider-uuid"
  }
}
```

---

### `PATCH /trips/:id/status` *(Driver actions)*
Update trip status (driver only — IN_PROGRESS, COMPLETED).

```
Request (start trip):
{
  "status": "IN_PROGRESS"
}

Request (complete trip):
{
  "status": "COMPLETED",
  "actualFare": 14000,
  "distance": 5.2,                   // km
  "duration": 18                     // minutes
}

Response 200:
{
  "trip": { ... updated trip ... }
}
```

---

### `POST /trips/:id/rate` *(Needed — may require backend addition)*
Submit a rating after trip completion.

```
Request (rider rates driver):
{
  "rating": 5,
  "comment": "Great driver!"
}

Request (driver rates rider):
{
  "rating": 4,
  "comment": "Polite rider"
}

Response 200:
{
  "success": true
}
```

---

### `GET /trips/history` *(Needed — may require backend addition)*
Get paginated trip history for the authenticated user.

```
Query: ?page=1&limit=20&role=rider

Response 200:
{
  "trips": [ ... ],
  "total": 87,
  "page": 1,
  "limit": 20,
  "totalPages": 5
}
```

---

## 4. Location Endpoints

### `POST /location/update`
Update driver's GPS position (driver only, called every 3 seconds).

```
Request:
{
  "driverId": "driver-uuid",
  "latitude": 33.3152,
  "longitude": 44.3661,
  "heading": 45.0,                  // Degrees (0-360)
  "speed": 35.5                    // km/h
}

Response 200:
{
  "success": true,
  "h3Index": "891f8a60007ffff"      // H3 cell at resolution 9
}
```

Backend Side Effects:
1. Updates Redis: `driver:location:{driverId}` (TTL 5 min)
2. Updates H3 cell set: `h3:drivers:{h3Index}`
3. Inserts into TimescaleDB `driver_locations` hypertable
4. Publishes `ain_rider.location_update` → websocket-server fans out to rider

---

### `GET /location/nearby`
Get nearby available drivers (for rider home screen map preview).

```
Query: ?latitude=33.3152&longitude=44.3661

Response 200:
{
  "drivers": [
    {
      "driverId": "driver-uuid-1",
      "latitude": 33.3160,
      "longitude": 44.3670,
      "h3Index": "891f8a60007ffff"
    },
    {
      "driverId": "driver-uuid-2",
      "latitude": 33.3145,
      "longitude": 44.3655,
      "h3Index": "891f8a60007ffff"
    }
  ],
  "centerH3": "891f8a60007ffff",
  "count": 2
}
```

---

### `GET /location/history/:driverId`
Get driver location history (for trip route replay).

```
Query: ?from=2026-03-26T10:00:00Z&to=2026-03-26T10:30:00Z

Response 200:
[
  { "latitude": 33.3152, "longitude": 44.3661, "recordedAt": "2026-03-26T10:00:00Z" },
  { "latitude": 33.3155, "longitude": 44.3665, "recordedAt": "2026-03-26T10:00:03Z" },
  ...
]
```

---

## 5. Match Endpoints (Driver)

### `POST /match/available`
Register driver as available for trips (driver goes online).

```
Request:
{
  "driverId": "driver-uuid",
  "latitude": 33.3152,
  "longitude": 44.3661,
  "vehicleTypeId": "sedan-uuid"
}

Response 200:
{
  "h3Index": "891f8a60007ffff"
}
```

Backend: Adds driver to Redis available pool with 5-min TTL. Must be refreshed periodically.

---

### `DELETE /match/available/:driverId`
Remove driver from available pool (driver goes offline).

```
Response 200:
{
  "success": true
}
```

---

### `GET /match/available`
Get list of available drivers (admin/debug).

```
Query: ?h3Index=891f8a60007ffff

Response 200:
{
  "drivers": [
    {
      "driverId": "uuid",
      "latitude": 33.3152,
      "longitude": 44.3661,
      "vehicleTypeId": "sedan-uuid",
      "h3Index": "891f8a60007ffff",
      "availableSince": "2026-03-26T10:00:00Z"
    }
  ],
  "count": 5
}
```

---

## 6. Payment Endpoints

### `GET /payments/:tripId` *(Needed — may require backend addition)*
Get payment details for a trip.

```
Response 200:
{
  "payment": {
    "id": "payment-uuid",
    "tripId": "trip-uuid",
    "riderId": "rider-uuid",
    "driverId": "driver-uuid",
    "amount": 14000,
    "currency": "IQD",
    "paymentMethod": "CASH",
    "status": "PENDING",
    "transactionId": null,
    "completedAt": null,
    "createdAt": "2026-03-26T10:18:00Z"
  }
}
```

---

### `POST /payments/:paymentId/confirm-cash` *(Needed — may require backend addition)*
Driver confirms cash collection.

```
Request:
{
  "collectedBy": "driver-uuid"
}

Response 200:
{
  "payment": {
    ...
    "status": "COMPLETED",
    "completedAt": "2026-03-26T10:20:00Z",
    "transactionId": "cash_1711440000000"
  }
}
```

---

### `GET /payments/history` *(Needed — may require backend addition)*
Get payment/earnings history.

```
Query: ?page=1&limit=20&from=2026-03-01&to=2026-03-26

Response 200:
{
  "payments": [ ... ],
  "total": 150,
  "totalAmount": 2100000,           // in IQD
  "page": 1,
  "limit": 20
}
```

---

## 7. Notification Endpoints *(Needed — may require backend additions)*

### `GET /notifications`
Get user's notifications.

```
Query: ?page=1&limit=20&unreadOnly=true

Response 200:
{
  "notifications": [
    {
      "id": "notif-uuid",
      "userId": "user-uuid",
      "title": "Trip Completed",
      "body": "Your trip to Mansour has been completed",
      "type": "TRIP_COMPLETED",
      "data": { "tripId": "trip-uuid" },
      "read": false,
      "createdAt": "2026-03-26T10:18:00Z"
    }
  ],
  "total": 45,
  "unreadCount": 3
}
```

---

### `PATCH /notifications/:id/read`
Mark a notification as read.

```
Response 200:
{ "success": true }
```

---

### `PATCH /notifications/read-all`
Mark all notifications as read.

```
Response 200:
{ "success": true }
```

---

## 8. Support & Safety Endpoints

### `POST /trips/:id/sos` *(Exists — trip-service publishes SOS_CREATED)*
Trigger SOS emergency alert.

```
Request:
{
  "userId": "user-uuid",
  "location": {
    "latitude": 33.3152,
    "longitude": 44.3661
  },
  "message": "I feel unsafe"
}

Response 200:
{
  "sosId": "sos-uuid",
  "success": true
}
```

Backend: Publishes `ain_rider.sos_created` → broadcasts to `support:all` WebSocket channel.

---

### `POST /complaints` *(Needed — may require backend addition)*
File a complaint about a trip.

```
Request:
{
  "tripId": "trip-uuid",
  "userId": "user-uuid",
  "category": "DRIVER_BEHAVIOR",     // "DRIVER_BEHAVIOR" | "FARE_DISPUTE" | "SAFETY" | "OTHER"
  "description": "Driver was rude",
  "attachments": []
}

Response 201:
{
  "complaint": {
    "id": "complaint-uuid",
    "status": "OPEN",
    "createdAt": "2026-03-26T10:20:00Z"
  }
}
```

---

## 9. Promo Code Endpoints

### `POST /trips/validate-promo` *(Needed — may require backend addition)*
Validate a promo code before trip creation.

```
Request:
{
  "code": "RIDE50",
  "riderId": "rider-uuid"
}

Response 200:
{
  "valid": true,
  "discount": 2500,
  "discountType": "FIXED",          // "FIXED" | "PERCENTAGE"
  "maxDiscount": null,
  "expiresAt": "2026-04-01T00:00:00Z"
}

Response 400:
{
  "valid": false,
  "error": "Promo code expired"
}
```

---

## 10. WebSocket Events

### Connection

```
URL: wss://api.ainrider.com/ws?token=<accessToken>

// Subscribe to channels after connection
→ { "type": "subscribe", "channel": "trip", "id": "trip-uuid:rider" }
→ { "type": "subscribe", "channel": "user", "id": "user-uuid" }
→ { "type": "subscribe", "channel": "driver", "id": "driver-uuid" }

// Heartbeat
→ { "type": "ping" }
← { "type": "pong", "timestamp": "2026-03-26T10:00:00Z" }
```

### Events → Mobile Actions

| Event | Payload | Mobile Action |
|-------|---------|---------------|
| `trip_matched` | `{ tripId, driverId, estimatedArrival }` | Navigate to active trip, show driver info |
| `trip_assigned` | `{ tripId, riderId, pickup, dropoff, fare }` | Show incoming trip bottom sheet (driver) |
| `trip_started` | `{ tripId }` | Update UI to "In Progress" state |
| `trip_completed` | `{ tripId, actualFare }` | Show trip summary, navigate to rating |
| `trip_cancelled` | `{ tripId, cancelledBy, reason }` | Show cancellation alert, return to home |
| `driver_location_update` | `{ driverId, latitude, longitude, heading, speed }` | Move driver marker on map (rider view) |
| `location_update` | `{ driverId, latitude, longitude }` | Confirmation of location push (driver) |
| `notification` | `{ title, body, data }` | Show in-app toast, update badge |
| `payment_processed` | `{ tripId, paymentId, amount, status }` | Update payment status |
| `sos_alert` | `{ tripId, userId, location }` | Show emergency alert (support) |

---

## 11. Scalability Notes for 1M+ Users

### API Design for Scale

| Strategy | Implementation |
|----------|---------------|
| **Rate Limiting** | Backend: 100 req/min per IP at API Gateway. Mobile: debounce UI actions, throttle location updates |
| **Pagination** | All list endpoints use `?page=N&limit=N`. Default limit: 20, max: 100 |
| **Compression** | Enable gzip on API Gateway. Mobile: Axios auto-decompresses |
| **CDN** | Profile images, vehicle photos served via CloudFront/Cloudflare CDN in front of MinIO |
| **Connection Pooling** | PgBouncer (5 instances) limits DB connections. Each service gets a pooled connection |

### High-Throughput Endpoints

| Endpoint | Volume (1M users) | Optimization |
|----------|-------------------|-------------|
| `POST /location/update` | ~100K req/s (drivers streaming GPS every 3s) | Elysia/Bun for max throughput, Redis pipeline, TimescaleDB hypertable with compression |
| `GET /location/nearby` | ~50K req/s (riders opening app) | Redis H3 cell sets, cached in Redis (5-min TTL) |
| WebSocket connections | ~200K concurrent | Horizontal WebSocket server scaling, NATS-based fan-out |
| `POST /trips` | ~10K req/s peak | Async NATS event → match-service processes out-of-band |
| `POST /match/available` | ~50K req/s (drivers refreshing availability) | Redis atomic operations, 5-min TTL auto-cleanup |

### Mobile-Side Optimizations

| Area | Strategy |
|------|----------|
| **Location batching** | Queue GPS updates, send in batch if network is slow |
| **Request deduplication** | React Query deduplicates identical in-flight requests |
| **Image caching** | Use `expo-image` with disk caching for profile/vehicle images |
| **Map clustering** | Cluster nearby driver markers when zoomed out (>50 markers) |
| **Lazy loading** | Defer non-critical screens (settings, history) until accessed |
| **Background fetch** | iOS Background App Refresh for driver location when app is backgrounded |
| **Binary protocol** | Consider Protocol Buffers for location updates if JSON overhead becomes a bottleneck |

### Infrastructure at Scale

```
                     ┌─────────────────────────┐
                     │       CloudFlare CDN      │
                     │    (SSL, DDoS, caching)   │
                     └────────────┬──────────────┘
                                  │
                     ┌────────────┴──────────────┐
                     │    Load Balancer (L7)      │
                     │  (API Gateway replicas)    │
                     └──────┬──────────┬──────────┘
                            │          │
                 ┌──────────┴──┐  ┌────┴──────────┐
                 │ API GW ×3   │  │ WS Server ×5  │
                 │ (Elysia)    │  │ (Elysia)      │
                 └──────┬──────┘  └────┬──────────┘
                        │              │
              ┌─────────┴──────────────┴──────────┐
              │         NATS JetStream ×3          │
              │    (quorum-based replication)       │
              └────────────┬───────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────┴─────┐   ┌──────┴──────┐   ┌──────┴──────┐
   │ Redis ×6  │   │ PostgreSQL  │   │ MinIO ×3    │
   │ (cluster) │   │ (primary +  │   │ (replicated)│
   │           │   │  replicas)  │   │             │
   └───────────┘   └─────────────┘   └─────────────┘
```

---

## 12. Error Response Format

All error responses follow a consistent format:

```json
{
  "success": false,
  "error": "Human readable error message",
  "code": "ERROR_CODE",
  "details": {}                      // Optional: field-level validation errors
}
```

### Common Error Codes

| HTTP | Code | Description |
|------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body/params |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 401 | `TOKEN_EXPIRED` | Access token expired (trigger refresh) |
| 403 | `FORBIDDEN` | Insufficient role permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Duplicate resource (email, phone) |
| 429 | `RATE_LIMITED` | Too many requests (wait and retry) |
| 500 | `INTERNAL_ERROR` | Server error (report to Sentry) |

### Mobile Error Handling Strategy

```
HTTP 401 (TOKEN_EXPIRED) → Auto-refresh token → Retry original request
HTTP 401 (UNAUTHORIZED)  → Force logout → Navigate to login
HTTP 429 (RATE_LIMITED)  → Show "Please wait" toast → Retry after delay
HTTP 5xx                 → Show "Something went wrong" → Retry button
Network Error            → Show "No internet" banner → Queue for retry
```

---

## Summary: Endpoints Needed from Backend

### Already Implemented ✅
| Endpoint | Service |
|----------|---------|
| `POST /auth/register` | auth-service |
| `POST /auth/login` | auth-service |
| `POST /auth/refresh` | auth-service |
| `POST /auth/logout` | auth-service |
| `GET /auth/me` | auth-service |
| `POST /trips` | trip-service |
| `GET /trips/:id` | trip-service |
| `PATCH /trips/:id/cancel` | trip-service |
| `POST /location/update` | location-service |
| `GET /location/nearby` | location-service |
| `GET /location/history/:driverId` | location-service |
| `POST /match/available` | match-service |
| `DELETE /match/available/:driverId` | match-service |
| `GET /match/available` | match-service |
| WebSocket subscribe/events | websocket-server |

### Needs Backend Addition ⚠️
| Endpoint | Purpose | Priority |
|----------|---------|----------|
| `POST /auth/device-token` | Push notification token registration | **P0** |
| `PATCH /auth/me` | Update user profile | **P0** |
| `POST /auth/me/avatar` | Upload profile image to MinIO | **P1** |
| `GET /auth/me/driver` | Get driver profile data | **P0** |
| `GET /auth/me/rider` | Get rider profile data | **P0** |
| `PATCH /trips/:id/status` | Driver starts/completes trip | **P0** |
| `POST /trips/:id/rate` | Post-trip rating | **P0** |
| `GET /trips/history` | Paginated trip history | **P0** |
| `GET /payments/:tripId` | Get trip payment details | **P1** |
| `POST /payments/:id/confirm-cash` | Driver confirms cash collection | **P0** |
| `GET /payments/history` | Earnings/payment history | **P1** |
| `GET /notifications` | User notifications list | **P1** |
| `PATCH /notifications/:id/read` | Mark notification read | **P2** |
| `PATCH /notifications/read-all` | Mark all notifications read | **P2** |
| `POST /trips/:id/sos` | Emergency SOS trigger | **P0** |
| `POST /complaints` | File a complaint | **P1** |
| `POST /trips/validate-promo` | Validate promo code | **P1** |
| Mobile auth (Bearer tokens in body) | Token-based auth for mobile | **P0** |

**Priority Legend**: P0 = Required for MVP, P1 = Important, P2 = Nice to have
