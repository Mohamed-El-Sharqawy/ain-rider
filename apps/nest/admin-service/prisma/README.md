# Admin Service Prisma Setup

This service uses **two separate Prisma clients** for different databases:

## 1. Admin Database (Own Schema)

**Schema**: `schema.prisma`  
**Config**: `prisma.config.ts`  
**Generated Client**: `src/generated/prisma/`  
**Connection**: `DATABASE_URL` (port 5435)

**Purpose**: Admin-service owns this schema and runs migrations.

**Models**:
- UserShadow (synced from auth-service via NATS)
- VehicleType, VehicleDocument
- Promo, PromoUsage
- Withdrawal
- Complaint
- Setting

**Commands**:
```bash
npx prisma generate                    # Generate client
npx prisma db push                     # Push schema changes
npx prisma migrate dev --name xyz      # Create migration
```

---

## 2. Trip Database (Read-Only)

**Schema**: `trip-schema.prisma`  
**Config**: `trip-config.ts`  
**Generated Client**: `src/generated/trip-prisma/`  
**Connection**: `TRIP_DATABASE_URL` (port 5436)

**Purpose**: Read-only access to trip-service's database.

**Models**:
- Trip (read-only)

**CRITICAL RULES**:
- ❌ Admin-service NEVER runs migrations on trip_db
- ❌ Admin-service NEVER writes directly to trip_db
- ✅ Admin-service READS via Prisma (instant, type-safe)
- ✅ Admin-service WRITES via NATS request-reply to trip-service

**Commands**:
```bash
# Only generate client (NEVER migrate or push)
npx prisma generate --schema=prisma/trip-schema.prisma
```

---

## Why Two Clients?

**Option A: Single Prisma Client (❌ Wrong)**
- Would require merging schemas → trip-service loses ownership
- Migration conflicts
- Violates microservices principle

**Option B: Raw SQL (❌ Suboptimal)**
- No type safety
- Manual query building
- No Prisma features (relations, aggregations)

**Option C: Two Prisma Clients (✅ Correct)**
- Trip-service owns trip_db schema and migrations
- Admin-service has read-only Prisma client for type-safe queries
- Zero schema conflicts
- Full Prisma query API for reads
- NATS request-reply for writes

---

## Usage in Code

```typescript
// Admin-service: trips.service.ts
import { TripDbService } from '../prisma/trip-db.service';
import { NatsService } from '../shared/nats/nats.service';

@Injectable()
export class TripsService {
  constructor(
    private tripDb: TripDbService,    // Read-only Prisma client
    private nats: NatsService,        // For write commands
  ) {}

  // READ → Direct Prisma query (instant)
  async findAll(filters: TripFiltersDto) {
    return this.tripDb.findAll(filters);
  }

  // WRITE → NATS request to trip-service (trip-service is sole writer)
  async cancelTrip(id: string, data: CancelTripDto) {
    return this.nats.requester.request(NATS_REQUESTS.TRIP_CANCEL, {
      tripId: id,
      reason: data.reason,
      cancelledBy: data.cancelledBy,
    });
  }
}
```

---

## Keeping Schemas in Sync

When trip-service updates its schema:

1. Trip-service runs migration:
   ```bash
   cd backend/apps/nest/trip-service
   npx prisma migrate dev --name add_new_field
   ```

2. Sync the Trip model to admin-service (automated):
   ```bash
   cd backend
   pnpm prisma:sync-trip-schema
   ```

3. Regenerate admin-service's read-only client:
   ```bash
   cd backend/apps/nest/admin-service
   npx prisma generate --schema=prisma/trip-schema.prisma
   ```

**The sync script** (`scripts/sync-trip-schema.mjs`) automatically:
- Extracts the Trip model from trip-service's schema
- Updates admin-service's trip-schema.prisma
- Adds a timestamp for tracking
- Preserves the read-only generator config

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ Admin-Service                                                   │
│                                                                 │
│  ┌─────────────────┐         ┌─────────────────┐              │
│  │ PrismaService   │         │ TripDbService   │              │
│  │ (admin_db)      │         │ (trip_db)       │              │
│  │                 │         │ READ-ONLY       │              │
│  │ - UserShadow    │         │ - Trip          │              │
│  │ - Promo         │         │                 │              │
│  │ - Complaint     │         │                 │              │
│  │ - Withdrawal    │         │                 │              │
│  └────────┬────────┘         └────────┬────────┘              │
│           │                           │                        │
│           ▼                           ▼                        │
│    admin_db (5435)            trip_db (5436)                   │
│    ✅ Read/Write              ✅ Read-only                      │
│                                                                 │
│  ┌─────────────────────────────────────────┐                  │
│  │ NatsService.requester                   │                  │
│  │ ✅ WRITE commands via NATS              │                  │
│  └──────────────────┬──────────────────────┘                  │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      │ NATS Request-Reply
                      │ (trip.cancel.request)
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Trip-Service                                                    │
│                                                                 │
│  ┌─────────────────────────────────────────┐                  │
│  │ TripCommandsService                     │                  │
│  │ ✅ Handles NATS write requests          │                  │
│  └──────────────────┬──────────────────────┘                  │
│                     │                                          │
│                     ▼                                          │
│  ┌─────────────────────────────────────────┐                  │
│  │ TripsService                            │                  │
│  │ ✅ SOLE WRITER to trip_db               │                  │
│  └──────────────────┬──────────────────────┘                  │
│                     │                                          │
│                     ▼                                          │
│              trip_db (5436)                                    │
│              ✅ Read/Write                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Benefits of This Architecture

1. **Type Safety**: Full Prisma types for reads (no manual SQL type casting)
2. **Query Builder**: Use Prisma's fluent API (where, orderBy, relations)
3. **Performance**: Prisma query optimization + connection pooling
4. **Write Isolation**: Trip-service is the only writer (enforced by NATS)
5. **Real-Time Reads**: No sync lag (admin sees live data instantly)
6. **Zero Schema Conflicts**: Each service owns its own migrations
7. **Maintainable**: Prisma queries are easier to read/modify than raw SQL

---

## Troubleshooting

**Issue**: `Cannot find module '../generated/trip-prisma/client'`  
**Fix**: Run `npx prisma generate --schema=prisma/trip-schema.prisma`

**Issue**: Schema out of sync with trip-service  
**Fix**: Copy Trip model from trip-service and regenerate client

**Issue**: Connection refused to TRIP_DATABASE_URL  
**Fix**: Ensure trip-service's PostgreSQL is running and port 5436 is accessible
