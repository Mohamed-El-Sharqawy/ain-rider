# Phase 4 - Complete Prisma Schemas for All Services

This document contains comprehensive Prisma schemas for all admin dashboard features.

---

## Admin Service - Complete Prisma Schema

The admin-service manages all admin dashboard features including vehicles, wallets, withdrawals, promos, notifications, SOS, complaints, reports, and settings.

Create `apps/nest/admin-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// VEHICLE MANAGEMENT
// ============================================

model VehicleType {
  id            String    @id @default(uuid())
  name          String
  type          String    // SEDAN, SUV, LUXURY, etc.
  baseFare      Float
  perKmRate     Float
  perMinuteRate Float
  minFare       Float
  maxPassengers Int
  imageUrl      String?
  isActive      Boolean   @default(true)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  
  vehicles      Vehicle[]

  @@map("vehicle_types")
}

model Vehicle {
  id                 String   @id @default(uuid())
  driverId           String
  vehicleTypeId      String
  make               String
  model              String
  year               Int
  color              String
  licensePlate       String   @unique
  registrationNumber String   @unique
  insuranceNumber    String
  insuranceExpiry    DateTime
  status             String   @default("ACTIVE") // ACTIVE, INACTIVE, MAINTENANCE, SUSPENDED
  imageUrl           String?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  vehicleType        VehicleType @relation(fields: [vehicleTypeId], references: [id])

  @@map("vehicles")
}

// ============================================
// WALLET & TRANSACTIONS
// ============================================

model Wallet {
  id        String   @id @default(uuid())
  userId    String   @unique
  balance   Float    @default(0)
  currency  String   @default("EGP")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  transactions WalletTransaction[]
  withdrawals  Withdrawal[]

  @@map("wallets")
}

model WalletTransaction {
  id            String   @id @default(uuid())
  walletId      String
  userId        String
  type          String   // CREDIT, DEBIT, REFUND, WITHDRAWAL, TRIP_PAYMENT, ADMIN_CREDIT
  amount        Float
  balanceBefore Float
  balanceAfter  Float
  status        String   @default("COMPLETED") // PENDING, COMPLETED, FAILED, CANCELLED
  description   String
  referenceId   String?  // Trip ID, Withdrawal ID, etc.
  createdAt     DateTime @default(now())

  wallet        Wallet   @relation(fields: [walletId], references: [id])

  @@index([userId])
  @@index([walletId])
  @@index([referenceId])
  @@map("wallet_transactions")
}

model Withdrawal {
  id                String    @id @default(uuid())
  userId            String
  walletId          String
  amount            Float
  status            String    @default("PENDING") // PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED
  bankAccountNumber String
  bankName          String
  accountHolderName String
  requestedAt       DateTime  @default(now())
  processedAt       DateTime?
  processedBy       String?   // Admin user ID
  rejectionReason   String?
  transactionId     String?
  
  wallet            Wallet    @relation(fields: [walletId], references: [id])

  @@index([userId])
  @@index([status])
  @@map("withdrawals")
}

// ============================================
// PROMOTIONAL CODES
// ============================================

model Promo {
  id                String      @id @default(uuid())
  code              String      @unique
  type              String      // PERCENTAGE, FIXED_AMOUNT, FREE_RIDE
  value             Float
  maxDiscount       Float?
  minTripAmount     Float?
  maxUsagePerUser   Int         @default(1)
  totalUsageLimit   Int
  currentUsageCount Int         @default(0)
  status            String      @default("ACTIVE") // ACTIVE, INACTIVE, EXPIRED, USED_UP
  validFrom         DateTime
  validUntil        DateTime
  description       String
  createdBy         String      // Admin user ID
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  usages            PromoUsage[]

  @@index([code])
  @@index([status])
  @@map("promos")
}

model PromoUsage {
  id             String   @id @default(uuid())
  promoId        String
  userId         String
  tripId         String
  discountAmount Float
  usedAt         DateTime @default(now())

  promo          Promo    @relation(fields: [promoId], references: [id])

  @@index([userId])
  @@index([promoId])
  @@map("promo_usages")
}

// ============================================
// NOTIFICATIONS
// ============================================

model Notification {
  id          String    @id @default(uuid())
  userId      String?   // null for broadcast
  type        String    // PUSH, SMS, EMAIL, IN_APP
  priority    String    @default("MEDIUM") // LOW, MEDIUM, HIGH, URGENT
  status      String    @default("PENDING") // PENDING, SENT, DELIVERED, FAILED, READ
  title       String
  body        String
  data        Json?     // Additional payload
  imageUrl    String?
  actionUrl   String?
  sentAt      DateTime?
  deliveredAt DateTime?
  readAt      DateTime?
  createdBy   String    // Admin user ID
  createdAt   DateTime  @default(now())

  @@index([userId])
  @@index([status])
  @@index([type])
  @@map("notifications")
}

// ============================================
// SOS ALERTS
// ============================================

model SOS {
  id                String    @id @default(uuid())
  userId            String
  tripId            String?
  status            String    @default("ACTIVE") // ACTIVE, RESOLVED, CANCELLED, FALSE_ALARM
  priority          String    @default("CRITICAL") // CRITICAL, HIGH, MEDIUM
  latitude          Float
  longitude         Float
  address           String
  reason            String?
  notes             String?
  emergencyContacts Json      // Array of phone numbers
  respondedBy       String?   // Admin/Support user ID
  responseNotes     String?
  createdAt         DateTime  @default(now())
  resolvedAt        DateTime?
  updatedAt         DateTime  @updatedAt

  @@index([userId])
  @@index([status])
  @@index([createdAt])
  @@map("sos_alerts")
}

model SOSContact {
  id           String   @id @default(uuid())
  userId       String
  name         String
  phoneNumber  String
  relationship String
  isPrimary    Boolean  @default(false)
  createdAt    DateTime @default(now())

  @@index([userId])
  @@map("sos_contacts")
}

// ============================================
// COMPLAINTS
// ============================================

model Complaint {
  id              String             @id @default(uuid())
  complainantId   String             // User who filed complaint
  complainantRole String             // RIDER, DRIVER
  againstUserId   String?            // User being complained about
  tripId          String?
  type            String             // DRIVER_BEHAVIOR, RIDER_BEHAVIOR, etc.
  status          String             @default("PENDING") // PENDING, UNDER_REVIEW, RESOLVED, REJECTED, ESCALATED
  priority        String             @default("MEDIUM") // LOW, MEDIUM, HIGH, CRITICAL
  subject         String
  description     String
  evidence        Json?              // Array of URLs
  assignedTo      String?            // Support/Admin user ID
  resolution      String?
  resolutionNotes String?
  createdAt       DateTime           @default(now())
  updatedAt       DateTime           @updatedAt
  resolvedAt      DateTime?

  comments        ComplaintComment[]

  @@index([complainantId])
  @@index([againstUserId])
  @@index([status])
  @@index([assignedTo])
  @@map("complaints")
}

model ComplaintComment {
  id          String   @id @default(uuid())
  complaintId String
  userId      String
  userRole    String   // USER, ADMIN, SUPPORT
  comment     String
  isInternal  Boolean  @default(false) // Internal notes vs user-visible
  createdAt   DateTime @default(now())

  complaint   Complaint @relation(fields: [complaintId], references: [id])

  @@index([complaintId])
  @@map("complaint_comments")
}

// ============================================
// SYSTEM SETTINGS
// ============================================

model Setting {
  id          String   @id @default(uuid())
  key         String   @unique
  value       String
  type        String   // STRING, NUMBER, BOOLEAN, JSON
  category    String   // GENERAL, PAYMENT, NOTIFICATION, PRICING, SECURITY, FEATURES
  description String
  isPublic    Boolean  @default(false) // Can be accessed by mobile apps
  updatedBy   String   // Admin user ID
  updatedAt   DateTime @updatedAt

  @@index([category])
  @@index([isPublic])
  @@map("settings")
}

// ============================================
// BOOKINGS (Manual Admin Bookings)
// ============================================

model Booking {
  id              String    @id @default(uuid())
  riderId         String
  driverId        String?
  pickupAddress   String
  pickupLat       Float
  pickupLng       Float
  dropoffAddress  String
  dropoffLat      Float
  dropoffLng      Float
  scheduledAt     DateTime?
  status          String    @default("PENDING") // PENDING, CONFIRMED, IN_PROGRESS, COMPLETED, CANCELLED
  fare            Float?
  paymentMethod   String    // CASH, CARD, WALLET
  notes           String?
  createdBy       String    // Admin user ID
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([riderId])
  @@index([driverId])
  @@index([status])
  @@map("bookings")
}
```

---

## Auth Service - Updated Schema

Update `apps/nest/auth-service/prisma/schema.prisma` to include wallet reference:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(uuid())
  email        String   @unique
  phoneNumber  String   @unique
  passwordHash String
  firstName    String
  lastName     String
  role         String   // RIDER, DRIVER, ADMIN, SUPPORT
  status       String   @default("ACTIVE") // ACTIVE, INACTIVE, SUSPENDED, BANNED
  profileImage String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}

model Driver {
  id            String   @id @default(uuid())
  userId        String   @unique
  vehicleId     String?
  licenseNumber String   @unique
  rating        Float    @default(5.0)
  totalTrips    Int      @default(0)
  isOnline      Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@map("drivers")
}

model Rider {
  id         String   @id @default(uuid())
  userId     String   @unique
  rating     Float    @default(5.0)
  totalTrips Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  @@map("riders")
}
```

---

## Trip Service - Updated Schema

Update `apps/nest/trip-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Trip {
  id                  String    @id @default(uuid())
  riderId             String
  driverId            String?
  status              String    @default("REQUESTED") // REQUESTED, MATCHED, DRIVER_ARRIVING, IN_PROGRESS, COMPLETED, CANCELLED
  pickupLat           Float
  pickupLng           Float
  pickupAddress       String
  dropoffLat          Float
  dropoffLng          Float
  dropoffAddress      String
  estimatedFare       Float
  actualFare          Float?
  paymentMethod       String    // CASH, CARD, WALLET
  promoCode           String?
  promoDiscount       Float     @default(0)
  distance            Float?    // meters
  duration            Int?      // seconds
  requestedAt         DateTime  @default(now())
  matchedAt           DateTime?
  startedAt           DateTime?
  completedAt         DateTime?
  cancelledAt         DateTime?
  cancellationReason  String?
  cancelledBy         String?   // USER_ID who cancelled
  driverRating        Float?
  riderRating         Float?
  updatedAt           DateTime  @updatedAt

  @@index([riderId])
  @@index([driverId])
  @@index([status])
  @@index([requestedAt])
  @@map("trips")
}
```

---

## Payment Service - Updated Schema

Update `apps/nest/payment-service/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Payment {
  id            String    @id @default(uuid())
  tripId        String    @unique
  riderId       String
  driverId      String
  amount        Float
  currency      String    @default("EGP")
  status        String    @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED, REFUNDED
  paymentMethod String    // CASH, CARD, WALLET
  transactionId String?
  gatewayResponse Json?
  createdAt     DateTime  @default(now())
  completedAt   DateTime?
  updatedAt     DateTime  @updatedAt

  @@index([tripId])
  @@index([riderId])
  @@index([driverId])
  @@index([status])
  @@map("payments")
}

model Refund {
  id          String   @id @default(uuid())
  paymentId   String
  amount      Float
  reason      String
  status      String   @default("PENDING") // PENDING, PROCESSING, COMPLETED, FAILED
  processedBy String?  // Admin user ID
  createdAt   DateTime @default(now())
  completedAt DateTime?

  @@index([paymentId])
  @@map("refunds")
}
```

---

## Migration Commands

After creating/updating schemas, run migrations for each service:

```bash
# Admin Service
cd apps/nest/admin-service
npx prisma migrate dev --name init_admin_features

# Auth Service
cd apps/nest/auth-service
npx prisma migrate dev --name add_user_fields

# Trip Service
cd apps/nest/trip-service
npx prisma migrate dev --name add_promo_and_ratings

# Payment Service
cd apps/nest/payment-service
npx prisma migrate dev --name add_refunds
```

---

## Notes

- All Prisma schemas use PostgreSQL via PgBouncer (DATABASE_URL)
- Each service owns its domain schema (strict service isolation)
- Shared data (like userId) is referenced but not joined across services
- Use NATS events for cross-service communication
- Admin service is the primary owner of admin dashboard features
