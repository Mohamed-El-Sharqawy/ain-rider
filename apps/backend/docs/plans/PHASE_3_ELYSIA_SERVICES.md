# Phase 3: Elysia/Bun Services Setup

**Estimated Time**: 2 hours  
**Prerequisites**: Phase 1 & 2 completed, Bun 1.2.21+ installed

---

## Objectives

Build 4 high-throughput Elysia/Bun services:

1. **api-gateway** - JWT auth, rate limiting, request routing
2. **websocket-server** - Real-time bidirectional communication
3. **location-service** - H3 geospatial indexing + TimescaleDB writes
4. **match-service** - Driver-rider matching algorithm

---

## Service 1: API Gateway

### Step 1.1: Initialize Service

```bash
cd apps/elysia/api-gateway
bun init -y
```

### Step 1.2: Create Package Configuration

Create `apps/elysia/api-gateway/package.json`:

```json
{
  "name": "@ain-rider/api-gateway",
  "version": "1.0.0",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "elysia": "^1.4.28",
    "@elysiajs/cors": "^1.4.1",
    "@elysiajs/swagger": "^1.3.1",
    "@elysiajs/jwt": "^1.4.1",
    "@elysiajs/bearer": "^1.4.3",
    "elysia-rate-limit": "^4.5.1",
    "ioredis": "^5.10.1",
    "nats": "^2.29.3",
    "prom-client": "^15.1.3",
    "@ain-rider/shared-types": "workspace:*",
    "@ain-rider/nats-client": "workspace:*",
    "@ain-rider/redis-client": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Step 1.3: Create TypeScript Config

Create `apps/elysia/api-gateway/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "react"
  }
}
```

### Step 1.4: Implement API Gateway

Create `apps/elysia/api-gateway/src/index.ts`:

```typescript
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { jwt } from '@elysiajs/jwt';
import { bearer } from '@elysiajs/bearer';
import { rateLimit } from 'elysia-rate-limit';
import { createRedisCluster, createCache } from '@ain-rider/redis-client';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import { register, collectDefaultMetrics } from 'prom-client';

// Environment variables
const PORT = parseInt(process.env.API_GATEWAY_PORT || '3000');
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');

// Initialize clients
const redisCluster = createRedisCluster({ nodes: REDIS_NODES });
const cache = createCache(redisCluster);

// Prometheus metrics
collectDefaultMetrics();

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: '911 Ain Rider API Gateway',
          version: '1.0.0',
        },
      },
    })
  )
  .use(
    jwt({
      name: 'jwt',
      secret: JWT_SECRET,
    })
  )
  .use(bearer())
  .use(
    rateLimit({
      duration: 60000, // 1 minute
      max: 100, // 100 requests per minute
      generator: (req) => req.headers.get('x-forwarded-for') || 'anonymous',
    })
  )
  // Health checks
  .get('/health', () => ({ status: 'ok', service: 'api-gateway' }))
  .get('/ready', async () => {
    try {
      await redisCluster.ping();
      return { status: 'ready', redis: 'connected' };
    } catch (error) {
      return { status: 'not ready', redis: 'disconnected' };
    }
  })
  // Metrics endpoint
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: { 'Content-Type': register.contentType },
    });
  })
  // Auth routes
  .group('/auth', (app) =>
    app
      .post('/login', async ({ body }: any) => {
        // Forward to auth-service
        const response = await fetch('http://auth-service:4000/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return response.json();
      })
      .post('/register', async ({ body }: any) => {
        const response = await fetch('http://auth-service:4000/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return response.json();
      })
  )
  // Trip routes (protected)
  .group('/trips', (app) =>
    app
      .derive(async ({ bearer, jwt, set }: any) => {
        if (!bearer) {
          set.status = 401;
          throw new Error('Unauthorized');
        }
        const payload = await jwt.verify(bearer);
        if (!payload) {
          set.status = 401;
          throw new Error('Invalid token');
        }
        return { user: payload };
      })
      .post('/request', async ({ body, user }: any) => {
        const response = await fetch('http://trip-service:4001/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...body, userId: user.id }),
        });
        return response.json();
      })
      .get('/:id', async ({ params, user }: any) => {
        const response = await fetch(`http://trip-service:4001/trips/${params.id}`, {
          headers: { 'x-user-id': user.id },
        });
        return response.json();
      })
  )
  .listen(PORT);

console.log(`🚀 API Gateway running at http://localhost:${PORT}`);
console.log(`📚 Swagger docs at http://localhost:${PORT}/swagger`);
```

---

## Service 2: WebSocket Server

### Step 2.1: Initialize Service

```bash
cd apps/elysia/websocket-server
bun init -y
```

### Step 2.2: Create Package Configuration

Create `apps/elysia/websocket-server/package.json`:

```json
{
  "name": "@ain-rider/websocket-server",
  "version": "1.0.0",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "elysia": "^1.4.28",
    "@elysiajs/cors": "^1.4.1",
    "ioredis": "^5.10.1",
    "nats": "^2.29.3",
    "prom-client": "^15.1.3",
    "@ain-rider/shared-types": "workspace:*",
    "@ain-rider/nats-client": "workspace:*",
    "@ain-rider/redis-client": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Step 2.3: Create TypeScript Config

Create `apps/elysia/websocket-server/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Step 2.4: Implement WebSocket Server

Create `apps/elysia/websocket-server/src/index.ts`:

```typescript
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { createRedisCluster } from '@ain-rider/redis-client';
import { createNatsConnection, createConsumer } from '@ain-rider/nats-client';
import { NATS_SUBJECTS, LocationUpdateEvent, TripMatchedEvent } from '@ain-rider/shared-types';
import { register, collectDefaultMetrics } from 'prom-client';

const PORT = parseInt(process.env.WEBSOCKET_PORT || '3001');
const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

// Initialize clients
const redisCluster = createRedisCluster({ nodes: REDIS_NODES });
collectDefaultMetrics();

// WebSocket connection store
const connections = new Map<string, any>();

// Initialize NATS consumer
(async () => {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'websocket-server' });
  const consumer = createConsumer(nc);

  // Subscribe to location updates
  await consumer.subscribe<LocationUpdateEvent['data']>(
    NATS_SUBJECTS.LOCATION_UPDATE,
    async (data) => {
      // Broadcast to connected riders tracking this driver
      const ws = connections.get(`driver:${data.driverId}`);
      if (ws) {
        ws.send(JSON.stringify({ type: 'location_update', data }));
      }
    }
  );

  // Subscribe to trip matched events
  await consumer.subscribe<TripMatchedEvent['data']>(
    NATS_SUBJECTS.TRIP_MATCHED,
    async (data) => {
      const riderWs = connections.get(`trip:${data.tripId}:rider`);
      const driverWs = connections.get(`driver:${data.driverId}`);
      
      if (riderWs) {
        riderWs.send(JSON.stringify({ type: 'trip_matched', data }));
      }
      if (driverWs) {
        driverWs.send(JSON.stringify({ type: 'trip_assigned', data }));
      }
    }
  );
})();

const app = new Elysia()
  .use(cors())
  .get('/health', () => ({ status: 'ok', service: 'websocket-server' }))
  .get('/ready', async () => {
    try {
      await redisCluster.ping();
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready' };
    }
  })
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: { 'Content-Type': register.contentType },
    });
  })
  .ws('/ws', {
    open(ws) {
      console.log('WebSocket connection opened');
    },
    message(ws, message: any) {
      try {
        const data = JSON.parse(message.toString());
        
        if (data.type === 'subscribe') {
          // Subscribe to specific channels
          const key = `${data.channel}:${data.id}`;
          connections.set(key, ws);
          console.log(`Client subscribed to ${key}`);
        }
        
        if (data.type === 'unsubscribe') {
          const key = `${data.channel}:${data.id}`;
          connections.delete(key);
          console.log(`Client unsubscribed from ${key}`);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    },
    close(ws) {
      // Remove all connections for this websocket
      for (const [key, conn] of connections.entries()) {
        if (conn === ws) {
          connections.delete(key);
        }
      }
      console.log('WebSocket connection closed');
    },
  })
  .listen(PORT);

console.log(`🚀 WebSocket Server running at ws://localhost:${PORT}/ws`);
```

---

## Service 3: Location Service

### Step 3.1: Initialize Service

```bash
cd apps/elysia/location-service
bun init -y
```

### Step 3.2: Create Package Configuration

Create `apps/elysia/location-service/package.json`:

```json
{
  "name": "@ain-rider/location-service",
  "version": "1.0.0",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "elysia": "^1.4.28",
    "@elysiajs/cors": "^1.4.1",
    "@elysiajs/swagger": "^1.3.1",
    "h3-js": "^4.4.0",
    "pg": "^8.20.0",
    "ioredis": "^5.10.1",
    "nats": "^2.29.3",
    "prom-client": "^15.1.3",
    "@ain-rider/shared-types": "workspace:*",
    "@ain-rider/nats-client": "workspace:*",
    "@ain-rider/redis-client": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/pg": "^8.11.10"
  }
}
```

### Step 3.3: Create TypeScript Config

Create `apps/elysia/location-service/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Step 3.4: Implement Location Service

Create `apps/elysia/location-service/src/index.ts`:

```typescript
import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { latLngToCell } from 'h3-js';
import { Pool } from 'pg';
import { createRedisCluster, createCache } from '@ain-rider/redis-client';
import { createNatsConnection, createPublisher } from '@ain-rider/nats-client';
import { NATS_SUBJECTS, LocationUpdate } from '@ain-rider/shared-types';
import { register, collectDefaultMetrics } from 'prom-client';

const PORT = parseInt(process.env.LOCATION_SERVICE_PORT || '3002');
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ainrider:password@localhost:5432/ainrider';
const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

// Initialize clients
const pgPool = new Pool({ connectionString: DATABASE_URL });
const redisCluster = createRedisCluster({ nodes: REDIS_NODES });
const cache = createCache(redisCluster);

let natsPublisher: any;

// Initialize NATS
(async () => {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'location-service' });
  natsPublisher = createPublisher(nc);
})();

collectDefaultMetrics();

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Location Service API',
          version: '1.0.0',
        },
      },
    })
  )
  .get('/health', () => ({ status: 'ok', service: 'location-service' }))
  .get('/ready', async () => {
    try {
      await pgPool.query('SELECT 1');
      await redisCluster.ping();
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready' };
    }
  })
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: { 'Content-Type': register.contentType },
    });
  })
  // Update driver location
  .post(
    '/location/update',
    async ({ body }: any) => {
      const { driverId, latitude, longitude, heading, speed } = body;

      // Calculate H3 index (resolution 9 = ~174m hexagons)
      const h3Index = latLngToCell(latitude, longitude, 9);

      const locationUpdate: LocationUpdate = {
        driverId,
        location: {
          latitude,
          longitude,
          timestamp: new Date(),
          heading,
          speed,
        },
        h3Index,
      };

      // Store in Redis for fast lookup
      await cache.set(`driver:location:${driverId}`, locationUpdate, 300); // 5 min TTL

      // Store in TimescaleDB for historical tracking
      await pgPool.query(
        `INSERT INTO driver_locations (driver_id, latitude, longitude, h3_index, heading, speed, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [driverId, latitude, longitude, h3Index, heading, speed, new Date()]
      );

      // Publish to NATS for real-time updates
      if (natsPublisher) {
        await natsPublisher.publish({
          subject: NATS_SUBJECTS.LOCATION_UPDATE,
          data: locationUpdate,
        });
      }

      return { success: true, h3Index };
    },
    {
      body: t.Object({
        driverId: t.String(),
        latitude: t.Number(),
        longitude: t.Number(),
        heading: t.Optional(t.Number()),
        speed: t.Optional(t.Number()),
      }),
    }
  )
  // Get nearby drivers
  .get('/location/nearby', async ({ query }: any) => {
    const { latitude, longitude, radiusMeters = 5000 } = query;

    // Get H3 index and neighbors
    const centerH3 = latLngToCell(parseFloat(latitude), parseFloat(longitude), 9);
    
    // Query drivers in nearby H3 cells
    const result = await pgPool.query(
      `SELECT DISTINCT ON (driver_id) 
        driver_id, latitude, longitude, h3_index, timestamp
       FROM driver_locations
       WHERE h3_index = $1
         AND timestamp > NOW() - INTERVAL '5 minutes'
       ORDER BY driver_id, timestamp DESC`,
      [centerH3]
    );

    return { drivers: result.rows, centerH3 };
  })
  .listen(PORT);

console.log(`🚀 Location Service running at http://localhost:${PORT}`);
```

---

## Service 4: Match Service

### Step 4.1: Initialize Service

```bash
cd apps/elysia/match-service
bun init -y
```

### Step 4.2: Create Package Configuration

Create `apps/elysia/match-service/package.json`:

```json
{
  "name": "@ain-rider/match-service",
  "version": "1.0.0",
  "module": "src/index.ts",
  "type": "module",
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target bun",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "elysia": "^1.4.28",
    "@elysiajs/cors": "^1.4.1",
    "@elysiajs/swagger": "^1.3.1",
    "h3-js": "^4.4.0",
    "ioredis": "^5.10.1",
    "nats": "^2.29.3",
    "prom-client": "^15.1.3",
    "@ain-rider/shared-types": "workspace:*",
    "@ain-rider/nats-client": "workspace:*",
    "@ain-rider/redis-client": "workspace:*"
  },
  "devDependencies": {
    "@types/bun": "latest"
  }
}
```

### Step 4.3: Create TypeScript Config

Create `apps/elysia/match-service/tsconfig.json`:

```json
{
  "extends": "../../../tsconfig.base.json",
  "compilerOptions": {
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "module": "ESNext",
    "target": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

### Step 4.4: Implement Match Service

Create `apps/elysia/match-service/src/index.ts`:

```typescript
import { Elysia, t } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { latLngToCell, gridDisk } from 'h3-js';
import { createRedisCluster, createCache } from '@ain-rider/redis-client';
import { createNatsConnection, createPublisher, createConsumer } from '@ain-rider/nats-client';
import { NATS_SUBJECTS, TripRequestedEvent } from '@ain-rider/shared-types';
import { register, collectDefaultMetrics } from 'prom-client';

const PORT = parseInt(process.env.MATCH_SERVICE_PORT || '3003');
const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');
const NATS_URL = process.env.NATS_URL || 'nats://localhost:4222';

// Initialize clients
const redisCluster = createRedisCluster({ nodes: REDIS_NODES });
const cache = createCache(redisCluster);

let natsPublisher: any;

// Initialize NATS
(async () => {
  const nc = await createNatsConnection({ url: NATS_URL, name: 'match-service' });
  natsPublisher = createPublisher(nc);
  const consumer = createConsumer(nc);

  // Listen for trip requests
  await consumer.subscribe<TripRequestedEvent['data']>(
    NATS_SUBJECTS.TRIP_REQUESTED,
    async (data) => {
      console.log('Processing trip request:', data.tripId);
      await matchDriver(data);
    }
  );
})();

collectDefaultMetrics();

// Matching algorithm
async function matchDriver(tripRequest: TripRequestedEvent['data']) {
  const { tripId, riderId, pickupLocation } = tripRequest;

  // Get H3 index for pickup location
  const h3Index = latLngToCell(pickupLocation.latitude, pickupLocation.longitude, 9);
  
  // Get nearby H3 cells (1 ring = 7 cells total including center)
  const nearbyH3Cells = gridDisk(h3Index, 1);

  // Find available drivers in nearby cells
  const availableDrivers: any[] = [];
  
  for (const cell of nearbyH3Cells) {
    const drivers = await cache.get<any[]>(`h3:drivers:${cell}`) || [];
    availableDrivers.push(...drivers);
  }

  if (availableDrivers.length === 0) {
    console.log('No drivers available for trip:', tripId);
    return;
  }

  // Simple matching: pick closest driver
  // In production, consider: rating, acceptance rate, vehicle type, etc.
  const selectedDriver = availableDrivers[0];

  // Publish match event
  if (natsPublisher) {
    await natsPublisher.publish({
      subject: NATS_SUBJECTS.TRIP_MATCHED,
      data: {
        tripId,
        driverId: selectedDriver.id,
        estimatedArrival: 300, // 5 minutes
      },
    });
  }

  // Remove driver from available pool
  await cache.del(`driver:available:${selectedDriver.id}`);

  console.log(`Matched trip ${tripId} with driver ${selectedDriver.id}`);
}

const app = new Elysia()
  .use(cors())
  .use(
    swagger({
      documentation: {
        info: {
          title: 'Match Service API',
          version: '1.0.0',
        },
      },
    })
  )
  .get('/health', () => ({ status: 'ok', service: 'match-service' }))
  .get('/ready', async () => {
    try {
      await redisCluster.ping();
      return { status: 'ready' };
    } catch (error) {
      return { status: 'not ready' };
    }
  })
  .get('/metrics', async () => {
    return new Response(await register.metrics(), {
      headers: { 'Content-Type': register.contentType },
    });
  })
  // Mark driver as available
  .post(
    '/driver/available',
    async ({ body }: any) => {
      const { driverId, latitude, longitude } = body;
      
      const h3Index = latLngToCell(latitude, longitude, 9);
      
      // Store driver in H3 cell
      const drivers = await cache.get<any[]>(`h3:drivers:${h3Index}`) || [];
      drivers.push({ id: driverId, latitude, longitude });
      await cache.set(`h3:drivers:${h3Index}`, drivers, 300);
      
      // Mark driver as available
      await cache.set(`driver:available:${driverId}`, { h3Index }, 300);
      
      return { success: true, h3Index };
    },
    {
      body: t.Object({
        driverId: t.String(),
        latitude: t.Number(),
        longitude: t.Number(),
      }),
    }
  )
  .listen(PORT);

console.log(`🚀 Match Service running at http://localhost:${PORT}`);
```

---

## Install Dependencies

Run from `backend/` root:

```bash
# Install all Elysia service dependencies
pnpm install

# Or install individually
cd apps/elysia/api-gateway && bun install
cd ../websocket-server && bun install
cd ../location-service && bun install
cd ../match-service && bun install
```

---

## Verification Steps

### Start Services Individually

```bash
# Terminal 1: API Gateway
cd apps/elysia/api-gateway
bun dev

# Terminal 2: WebSocket Server
cd apps/elysia/websocket-server
bun dev

# Terminal 3: Location Service
cd apps/elysia/location-service
bun dev

# Terminal 4: Match Service
cd apps/elysia/match-service
bun dev
```

### Test Endpoints

```bash
# Health checks
curl http://localhost:3000/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Swagger docs
open http://localhost:3000/swagger
open http://localhost:3002/swagger
open http://localhost:3003/swagger
```

---

## Common Issues

### Issue: Bun not found
**Solution**: Install Bun:
```bash
curl -fsSL https://bun.sh/install | bash
```

### Issue: Port already in use
**Solution**: Change port in `.env` or kill existing process:
```bash
lsof -ti:3000 | xargs kill -9
```

### Issue: Cannot connect to Redis/NATS
**Solution**: Ensure Docker Compose infrastructure is running:
```bash
cd backend
docker-compose up -d
```

---

## Next Steps

✅ Phase 3 Complete!

Proceed to **Phase 4**: `PHASE_4_NESTJS_SERVICES.md`
