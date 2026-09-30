# 911 Ain Rider Backend - Master Execution Checklist

Use this checklist to track your progress through all 6 phases.

---

## Phase 1: Workspace & Foundation ✓

- [ ] Create root `package.json` with workspace scripts
- [ ] Create `pnpm-workspace.yaml` configuration
- [ ] Create `tsconfig.base.json` with strict TypeScript settings
- [ ] Create directory structure (apps/elysia, apps/nest, packages)
- [ ] Create `.env.example` for local development
- [ ] Create `.env.k8s.example` for Kubernetes
- [ ] Create `.gitignore`
- [ ] Create `README.md`
- [ ] Initialize Git repository
- [ ] Verify workspace with `pnpm list --depth 0`

**Estimated Time**: 30 minutes

---

## Phase 2: Shared Packages ✓

### @ain-rider/shared-types
- [ ] Create package.json and tsconfig.json
- [ ] Define `user.types.ts` (User, Driver, Rider)
- [ ] Define `location.types.ts` (Coordinates, Location, LocationUpdate)
- [ ] Define `trip.types.ts` (Trip, TripStatus, TripRequest)
- [ ] Define `payment.types.ts` (Payment, PaymentStatus, Fare)
- [ ] Define `events.types.ts` (NATS event schemas)
- [ ] Create `index.ts` barrel export
- [ ] Build package: `pnpm build`

### @ain-rider/nats-client
- [ ] Create package.json and tsconfig.json
- [ ] Implement `connection.ts` (createNatsConnection)
- [ ] Implement `publisher.ts` (NatsPublisher class)
- [ ] Implement `consumer.ts` (NatsConsumer class)
- [ ] Create `index.ts` barrel export
- [ ] Build package: `pnpm build`

### @ain-rider/redis-client
- [ ] Create package.json and tsconfig.json
- [ ] Implement `cluster.ts` (createRedisCluster)
- [ ] Implement `cache.ts` (RedisCache class)
- [ ] Create `index.ts` barrel export
- [ ] Build package: `pnpm build`

### Verification
- [ ] Run `pnpm install` at root
- [ ] Build all packages: `pnpm --filter './packages/**' build`
- [ ] Verify dist/ folders exist for all packages

**Estimated Time**: 45 minutes

---

## Phase 3: Elysia/Bun Services ✓

### API Gateway (Port 3000)
- [ ] Initialize with `bun init`
- [ ] Create package.json with dependencies
- [ ] Create tsconfig.json
- [ ] Implement JWT authentication
- [ ] Implement rate limiting
- [ ] Add CORS and Swagger
- [ ] Create health/ready/metrics endpoints
- [ ] Implement auth routes (login, register)
- [ ] Implement protected trip routes
- [ ] Test: `bun dev` and `curl http://localhost:3000/health`

### WebSocket Server (Port 3001)
- [ ] Initialize with `bun init`
- [ ] Create package.json with dependencies
- [ ] Create tsconfig.json
- [ ] Implement WebSocket connection handling
- [ ] Subscribe to NATS location updates
- [ ] Subscribe to NATS trip matched events
- [ ] Broadcast events to connected clients
- [ ] Test: `bun dev` and WebSocket connection

### Location Service (Port 3002)
- [ ] Initialize with `bun init`
- [ ] Create package.json with h3-js and pg
- [ ] Create tsconfig.json
- [ ] Implement location update endpoint
- [ ] Calculate H3 geospatial index
- [ ] Store in Redis and TimescaleDB
- [ ] Publish to NATS
- [ ] Implement nearby drivers endpoint
- [ ] Test: `bun dev` and POST location update

### Match Service (Port 3003)
- [ ] Initialize with `bun init`
- [ ] Create package.json with h3-js
- [ ] Create tsconfig.json
- [ ] Subscribe to NATS trip requested events
- [ ] Implement driver matching algorithm
- [ ] Use H3 grid for nearby driver search
- [ ] Publish trip matched events
- [ ] Implement driver availability endpoint
- [ ] Test: `bun dev` and driver matching flow

### Verification
- [ ] All 4 services start without errors
- [ ] Health endpoints return 200 OK
- [ ] Swagger docs accessible
- [ ] Services connect to Redis and NATS

**Estimated Time**: 2 hours

---

## Phase 4: NestJS Services ✓

### Auth Service (Port 4000)
- [ ] Scaffold with `nest new auth-service`
- [ ] Install dependencies (Fastify, Prisma, JWT, bcrypt)
- [ ] Initialize Prisma with `npx prisma init`
- [ ] Create Prisma schema (User, Driver models)
- [ ] Create PrismaService and PrismaModule
- [ ] Implement AuthService (register, login, validate)
- [ ] Implement AuthController
- [ ] Create JwtStrategy and JwtAuthGuard
- [ ] Create HealthController
- [ ] Update main.ts for Fastify
- [ ] Run migration: `npx prisma migrate dev --name init`
- [ ] Test: `pnpm start:dev` and POST /auth/register

### Trip Service (Port 4001)
- [ ] Scaffold with `nest new trip-service`
- [ ] Install dependencies
- [ ] Initialize Prisma
- [ ] Create Prisma schema (Trip model)
- [ ] Create PrismaService and PrismaModule
- [ ] Implement TripsService (CRUD + NATS publishing)
- [ ] Implement TripsController
- [ ] Create HealthController
- [ ] Update main.ts for Fastify
- [ ] Run migration
- [ ] Test: `pnpm start:dev` and POST /trips

### Payment Service (Port 4002)
- [ ] Scaffold with `nest new payment-service`
- [ ] Install dependencies
- [ ] Initialize Prisma
- [ ] Create Prisma schema (Payment model)
- [ ] Create PrismaService and PrismaModule
- [ ] Implement PaymentsService (create, process)
- [ ] Implement PaymentsController
- [ ] Create HealthController
- [ ] Update main.ts for Fastify
- [ ] Run migration
- [ ] Test: `pnpm start:dev` and POST /payments

### Admin Service (Port 4003)
- [ ] Scaffold with `nest new admin-service`
- [ ] Install dependencies
- [ ] Implement AnalyticsService (Redis aggregation)
- [ ] Implement AnalyticsController
- [ ] Create HealthController
- [ ] Update main.ts for Fastify
- [ ] Test: `pnpm start:dev` and GET /analytics/dashboard

### Verification
- [ ] All 4 services start without errors
- [ ] Health endpoints return 200 OK
- [ ] Prisma clients generated
- [ ] Database migrations applied
- [ ] Services connect to PostgreSQL via PgBouncer

**Estimated Time**: 3 hours

---

## Phase 5: Docker & Infrastructure ✓

### Docker Compose Setup
- [ ] Create `docker-compose.yml`
- [ ] Configure PostgreSQL with TimescaleDB
- [ ] Configure PgBouncer (transaction pooling)
- [ ] Configure 6 Redis nodes (redis-1 to redis-6)
- [ ] Configure redis-cluster-init job
- [ ] Configure NATS JetStream
- [ ] Configure MinIO S3
- [ ] Configure minio-init bucket creation
- [ ] Create network `ain-rider-net`
- [ ] Create volumes for persistence

### Database Initialization
- [ ] Create `scripts/init-db.sql`
- [ ] Enable TimescaleDB extension
- [ ] Enable PostGIS extension
- [ ] Create driver_locations hypertable
- [ ] Create indexes
- [ ] Set retention policy (30 days)

### Dockerfiles - Elysia Services
- [ ] Create `apps/elysia/api-gateway/Dockerfile`
- [ ] Create `apps/elysia/websocket-server/Dockerfile`
- [ ] Create `apps/elysia/location-service/Dockerfile`
- [ ] Create `apps/elysia/match-service/Dockerfile`
- [ ] Use multi-stage builds (deps + runner)
- [ ] Copy shared packages
- [ ] Expose correct ports

### Dockerfiles - NestJS Services
- [ ] Create `apps/nest/auth-service/Dockerfile`
- [ ] Create `apps/nest/trip-service/Dockerfile`
- [ ] Create `apps/nest/payment-service/Dockerfile`
- [ ] Create `apps/nest/admin-service/Dockerfile`
- [ ] Use multi-stage builds (builder + runner)
- [ ] Run `prisma generate` in builder
- [ ] Copy dist and node_modules

### Verification
- [ ] Start infrastructure: `docker-compose up -d`
- [ ] Verify PostgreSQL: `docker exec -it ain-rider-postgres psql -U ainrider`
- [ ] Verify Redis Cluster: `docker exec -it ain-rider-redis-1 redis-cli cluster info`
- [ ] Verify NATS: `curl http://localhost:8222/varz`
- [ ] Verify MinIO: `open http://localhost:9001`
- [ ] Run migrations for all NestJS services
- [ ] Build all Docker images: `pnpm docker:build:all`

**Estimated Time**: 1.5 hours

---

## Phase 6: Kubernetes & Production ✓

### Namespace & Secrets
- [ ] Create `k8s/namespace.yaml`
- [ ] Create `k8s/secrets.yaml` (postgres, jwt, minio)
- [ ] Apply namespace: `kubectl apply -f k8s/namespace.yaml`
- [ ] Apply secrets: `kubectl apply -f k8s/secrets.yaml`

### Infrastructure Deployments
- [ ] Create `k8s/postgres.yaml` (PVC + Deployment + Service)
- [ ] Create `k8s/pgbouncer.yaml` (Deployment + Service)
- [ ] Create `k8s/redis-cluster.yaml` (StatefulSet + Service + Job)
- [ ] Create `k8s/nats.yaml` (StatefulSet + Service)
- [ ] Create `k8s/minio.yaml` (PVC + Deployment + Service)
- [ ] Apply all infrastructure manifests
- [ ] Wait for pods to be ready

### Microservices Deployments
- [ ] Create `k8s/api-gateway.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/websocket-server.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/location-service.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/match-service.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/auth-service.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/trip-service.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/payment-service.yaml` (Deployment + Service + HPA)
- [ ] Create `k8s/admin-service.yaml` (Deployment + Service + HPA)
- [ ] Configure resource requests/limits
- [ ] Configure liveness/readiness probes
- [ ] Apply all service manifests

### Ingress & Load Balancing
- [ ] Create `k8s/ingress.yaml`
- [ ] Configure TLS/SSL certificates
- [ ] Configure routing rules
- [ ] Apply ingress: `kubectl apply -f k8s/ingress.yaml`

### Database Migrations
- [ ] Run migration job for auth-service
- [ ] Run migration job for trip-service
- [ ] Run migration job for payment-service
- [ ] Verify migrations applied

### Verification
- [ ] Check all pods: `kubectl get pods -n ain-rider`
- [ ] Check services: `kubectl get svc -n ain-rider`
- [ ] Check HPA: `kubectl get hpa -n ain-rider`
- [ ] Check ingress: `kubectl get ingress -n ain-rider`
- [ ] Test API endpoints via ingress
- [ ] Verify Redis Cluster: `kubectl exec -it redis-0 -n ain-rider -- redis-cli cluster info`
- [ ] Check logs for errors

### Production Hardening
- [ ] Update all secrets with strong passwords
- [ ] Enable TLS/SSL for all services
- [ ] Configure network policies
- [ ] Set up pod disruption budgets
- [ ] Deploy Prometheus + Grafana
- [ ] Configure alerting rules
- [ ] Set up log aggregation
- [ ] Enable distributed tracing
- [ ] Configure backup strategies
- [ ] Perform load testing

**Estimated Time**: 2.5 hours

---

## Final Verification Checklist

### Local Development
- [ ] All 8 services run locally with `pnpm dev`
- [ ] Docker Compose infrastructure runs without errors
- [ ] Redis Cluster has 6 nodes (3 masters, 3 replicas)
- [ ] PostgreSQL + PgBouncer accessible on port 5432
- [ ] NATS accessible on port 4222
- [ ] MinIO accessible on ports 9000/9001
- [ ] All health endpoints return 200 OK
- [ ] Database migrations applied successfully

### Kubernetes Production
- [ ] All pods in Running state
- [ ] No CrashLoopBackOff errors
- [ ] HPA configured for all services
- [ ] Ingress routing works correctly
- [ ] TLS certificates valid
- [ ] Monitoring dashboards operational
- [ ] Alerting rules configured
- [ ] Backup jobs scheduled
- [ ] Load testing passed

### Architecture Validation
- [ ] Elysia services handle high throughput
- [ ] WebSocket connections stable
- [ ] Location updates processed in real-time
- [ ] Driver matching algorithm works
- [ ] NestJS services handle business logic
- [ ] Prisma ORM queries optimized
- [ ] NATS events published/consumed correctly
- [ ] Redis Cluster distributes load
- [ ] PgBouncer pools connections efficiently
- [ ] TimescaleDB stores location history

---

## Success Metrics

**You have successfully completed the backend when:**

✅ **8 microservices** deployed and running  
✅ **Redis Cluster** with 6 nodes operational  
✅ **PostgreSQL + PgBouncer** handling connections  
✅ **NATS JetStream** streaming events  
✅ **MinIO S3** storing files  
✅ **Kubernetes** auto-scaling services  
✅ **Ingress** load balancing traffic  
✅ **Health checks** passing  
✅ **Metrics** being collected  
✅ **Logs** being aggregated  

---

## Total Estimated Time: ~10 hours

- Phase 1: 30 min
- Phase 2: 45 min
- Phase 3: 2 hours
- Phase 4: 3 hours
- Phase 5: 1.5 hours
- Phase 6: 2.5 hours

---

## Quick Reference Commands

### Development
```bash
# Start infrastructure
docker-compose up -d

# Start all services
pnpm dev

# Build all packages
pnpm build

# Run migrations
pnpm prisma:migrate
```

### Docker
```bash
# Build all images
pnpm docker:build:all

# View logs
docker-compose logs -f

# Restart service
docker-compose restart [service]
```

### Kubernetes
```bash
# Deploy all
kubectl apply -f k8s/

# Check status
kubectl get all -n ain-rider

# View logs
kubectl logs -f deployment/api-gateway -n ain-rider

# Scale service
kubectl scale deployment api-gateway --replicas=5 -n ain-rider
```

---

## Troubleshooting Guide

### Redis Cluster Issues
```bash
# Check cluster status
docker exec -it ain-rider-redis-1 redis-cli cluster info

# Recreate cluster
docker-compose down -v
docker-compose up -d
```

### Database Connection Issues
```bash
# Test PostgreSQL
docker exec -it ain-rider-postgres psql -U ainrider -d ainrider

# Check PgBouncer
docker-compose logs pgbouncer
```

### Service Startup Issues
```bash
# Check logs
docker-compose logs [service-name]

# Restart service
docker-compose restart [service-name]
```

### Kubernetes Pod Issues
```bash
# Describe pod
kubectl describe pod [pod-name] -n ain-rider

# Check events
kubectl get events -n ain-rider --sort-by='.lastTimestamp'

# Delete and recreate
kubectl delete pod [pod-name] -n ain-rider
```

---

**Good luck with your backend implementation! 🚀**
