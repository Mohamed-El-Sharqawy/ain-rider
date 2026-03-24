# Phase 6: Kubernetes — Local (k3d) and Production

**Prerequisites**: Phase 5 complete, Docker Desktop running  
**Goal**: Run the full stack in Kubernetes locally via k3d, then use the same manifests + Helm values for production on bare-metal servers.

---

## Overview

This phase has two parts that share the same manifests:

- **Part A — k3d Local**: Run a full production-replica Kubernetes cluster on your Windows machine. Use this for end-to-end testing, WebSocket/Ingress testing, and pre-production validation.
- **Part B — Production**: Deploy the same Helm charts and manifests to real servers. Only replica counts, resource limits, and secrets change between the two.

---

## What Already Exists in the Repo

These files were created as part of this phase and are ready to use:

```
ain-rider/
├── k8s-local/
│   ├── namespace.yaml              ← ainrider namespace
│   ├── services.yaml               ← all 8 service Deployments + ClusterIP Services
│   ├── ingress.yaml                ← hostname routing (api + ws)
│   ├── pgbouncer.yaml              ← PgBouncer Deployment + Service
│   └── helm-values/
│       ├── nats.yaml               ← NATS JetStream with JetStream + persistent storage
│       ├── redis.yaml              ← Redis standalone (local) / cluster (prod)
│       └── postgres.yaml           ← PostgreSQL with driver_locations hypertable init SQL
├── scripts/
│   ├── k3d-setup.sh                ← idempotent: installs all Helm infra
│   ├── k3d-build.sh                ← builds Elysia images + loads into k3d + deploys
│   ├── k3d-redeploy.sh             ← rebuilds one service after a code change
│   └── k3d-destroy.sh              ← tears down the entire cluster
└── backend/apps/elysia/
    ├── api-gateway/Dockerfile
    ├── websocket-server/Dockerfile
    ├── location-service/Dockerfile
    └── match-service/Dockerfile
```

---

## Part A — k3d Local Cluster

### What You Have Right Now

| Tool | Status |
|---|---|
| Docker Desktop 28.4.0 | Installed |
| kubectl v1.32.2 | Installed |
| winget v1.28 | Installed |
| k3d | **Missing — install below** |
| Helm | **Missing — install below** |

---

### A1 — Install Missing Tools

Run in **PowerShell as Administrator**:

```powershell
winget install k3d.k3d
winget install Helm.Helm

# Restart terminal, then verify
k3d version
helm version
```

> All `scripts/` files are bash. Run them in **Git Bash** (included with Git for Windows). `kubectl` and `k3d` commands also work natively in PowerShell if you prefer.

---

### A2 — Add Local DNS

Open `C:\Windows\System32\drivers\etc\hosts` in **Notepad as Administrator** and add:

```
127.0.0.1   api.911ainrider.local
127.0.0.1   ws.911ainrider.local
```

---

### A3 — Create the Cluster

```bash
k3d cluster create ainrider \
  --agents 2 \
  --k3s-arg "--disable=traefik@server:0" \
  -p "80:80@loadbalancer" \
  -p "443:443@loadbalancer" \
  --wait

kubectl get nodes
# k3d-ainrider-server-0    Ready
# k3d-ainrider-agent-0     Ready
# k3d-ainrider-agent-1     Ready
```

---

### A4 — Install Infrastructure (automated, idempotent)

```bash
# From monorepo root: d:\Work\ain-rider
bash scripts/k3d-setup.sh
```

The script installs in this order:

| Component | Helm Chart | Config File |
|---|---|---|
| Nginx Ingress | ingress-nginx/ingress-nginx | (default values) |
| NATS JetStream | nats/nats | k8s-local/helm-values/nats.yaml |
| Redis standalone | bitnami/redis | k8s-local/helm-values/redis.yaml |
| PostgreSQL + init SQL | bitnami/postgresql | k8s-local/helm-values/postgres.yaml |
| PgBouncer | custom Deployment | k8s-local/pgbouncer.yaml |

The `postgres.yaml` values file runs `driver_locations` TimescaleDB hypertable creation on first start.

---

### A5 — Build Elysia Images and Deploy

```bash
# Build all 4 Elysia services, load into k3d, apply manifests
bash scripts/k3d-build.sh

# Or build a single service
bash scripts/k3d-build.sh match-service
```

What each build does:
1. `docker build` from the service's `Dockerfile`
2. `k3d image import` — loads the image directly into the cluster (no registry needed)
3. `kubectl apply -f k8s-local/services.yaml` + `k8s-local/ingress.yaml`
4. `kubectl rollout status` — waits for pods to be Ready

> The NestJS services (`auth-service`, `trip-service`, etc.) in `services.yaml` will be `CrashLoopBackOff` until Phase 4 (NestJS) is complete. This is expected — the Elysia services run independently.

---

### A6 — Verify

```bash
kubectl get pods -n ainrider
# NAME                            READY   STATUS
# nats-0                          2/2     Running
# redis-master-0                  1/1     Running
# postgres-postgresql-0           1/1     Running
# pgbouncer-xxx                   1/1     Running
# api-gateway-xxx                 1/1     Running
# websocket-server-xxx            1/1     Running
# location-service-xxx            1/1     Running
# match-service-xxx               1/1     Running

# REST health
curl http://api.911ainrider.local/health
# {"status":"ok","service":"api-gateway"}

# Swagger UI
# http://api.911ainrider.local/swagger

# WebSocket (npm install -g wscat)
wscat -c ws://ws.911ainrider.local/ws
# send: {"type":"ping"}
# recv: {"type":"pong","timestamp":"..."}

# Prometheus metrics
curl http://api.911ainrider.local/metrics
```

---

### A7 — Daily Workflow

```bash
# Start cluster after PC restart
k3d cluster start ainrider

# Stop cluster (free RAM)
k3d cluster stop ainrider

# Rebuild one service after code change
bash scripts/k3d-redeploy.sh match-service

# Watch all pods live
kubectl get pods -n ainrider -w

# Stream logs
kubectl logs -n ainrider -l app=match-service -f

# Shell into a pod
kubectl exec -it -n ainrider deploy/api-gateway -- sh

# Inspect NATS events
kubectl exec -it -n ainrider nats-0 -c nats-box -- sh
# nats sub ">" --server nats://localhost:4222

# Inspect Redis state
kubectl exec -it -n ainrider deploy/redis-master -- redis-cli
# KEYS "match:*"

# Tear down everything
bash scripts/k3d-destroy.sh
```

---

### A8 — Optional: Observability Stack

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=ainrider123 \
  --wait

# Access locally
kubectl port-forward -n monitoring svc/monitoring-grafana 3030:80
# http://localhost:3030  (admin / ainrider123)
```

---

### Minimum System Requirements for k3d

| Resource | Minimum | Recommended |
|---|---|---|
| Free RAM for Docker | 8 GB | 12 GB |
| CPU cores | 4 | 8 |
| Free disk | 20 GB | 40 GB |

Set Docker Desktop → Resources → Memory to at least **8 GB**.

---

## Part B — Production Deployment

When you buy your servers, the same Helm charts and manifests are used. The differences are:

| Setting | k3d Local | Production |
|---|---|---|
| Redis | standalone (1 node) | cluster mode (6 nodes StatefulSet) |
| NATS | 1 replica | 3 replicas (cluster) |
| PostgreSQL | bitnami/postgresql | timescale/timescaledb-ha:pg17 |
| Service replicas | 1 per service | 2–3 (+ HPA) |
| Secrets | hardcoded in env | Kubernetes Secrets from vault/sealed-secrets |
| Ingress TLS | none (HTTP) | cert-manager + Let's Encrypt |
| Image source | `imagePullPolicy: Never` (local) | Container registry (e.g. GHCR, Docker Hub) |

---

### B1 — Namespace and Secrets

```bash
kubectl apply -f k8s-local/namespace.yaml

kubectl create secret generic ainrider-secrets \
  --namespace ainrider \
  --from-literal=postgres-password='CHANGE_ME' \
  --from-literal=jwt-secret='CHANGE_ME' \
  --from-literal=minio-access-key='CHANGE_ME' \
  --from-literal=minio-secret-key='CHANGE_ME'
```

---

### B2 — Production Helm Values (Redis Cluster)

Create `k8s-local/helm-values/redis-prod.yaml`:

```yaml
architecture: cluster

auth:
  enabled: true
  password: "CHANGE_ME_IN_PROD"

cluster:
  nodes: 6
  replicas: 1

master:
  persistence:
    enabled: true
    size: 10Gi
  resources:
    requests:
      memory: 512Mi
      cpu: 250m
    limits:
      memory: 1Gi
      cpu: 500m
```

```bash
helm install redis bitnami/redis \
  --namespace ainrider \
  -f k8s-local/helm-values/redis-prod.yaml
```

---

### B3 — Production Helm Values (NATS 3-node cluster)

Create `k8s-local/helm-values/nats-prod.yaml`:

```yaml
config:
  cluster:
    enabled: true
    replicas: 3
  jetstream:
    enabled: true
    fileStore:
      enabled: true
      dir: /data
      pvc:
        enabled: true
        size: 20Gi
    memoryStore:
      enabled: true
      maxSize: 1Gi
```

```bash
helm install nats nats/nats \
  --namespace ainrider \
  -f k8s-local/helm-values/nats-prod.yaml
```

---

### B4 — Production PostgreSQL (TimescaleDB HA)

```bash
helm repo add timescale https://charts.timescale.com

helm install postgres timescale/timescaledb-single \
  --namespace ainrider \
  --set replicaCount=1 \
  --set patroni.postgresql.pg_hba=["host all all 0.0.0.0/0 md5"] \
  --set credentials.superuser=ainrider \
  --set credentials.admin=ainrider \
  --set persistentVolumes.data.size=50Gi
```

---

### B5 — Update Services for Production

Change these values in `k8s-local/services.yaml` before applying to production:

1. `imagePullPolicy: Never` → `imagePullPolicy: Always`
2. `image: ainrider/<service>:local` → `image: ghcr.io/<org>/<service>:latest`
3. `replicas: 1` → `replicas: 2` (or 3 for public-facing services)
4. Hardcoded env secrets → `secretKeyRef` references
5. `REDIS_NODES: redis-master:6379` → the 6 cluster node addresses

Add HPA for public-facing services:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: ainrider
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

---

### B6 — Production Ingress (TLS via cert-manager)

```bash
# Install cert-manager
helm repo add jetstack https://charts.jetstack.io
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager --create-namespace \
  --set installCRDs=true
```

Create `k8s-local/ingress-prod.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ainrider-ingress
  namespace: ainrider
  annotations:
    nginx.ingress.kubernetes.io/proxy-read-timeout: "3600"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "3600"
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header Upgrade $http_upgrade;
      proxy_set_header Connection "upgrade";
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - api.911ainrider.com
    - ws.911ainrider.com
    secretName: ainrider-tls
  rules:
  - host: api.911ainrider.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-gateway
            port:
              number: 3000
  - host: ws.911ainrider.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: websocket-server
            port:
              number: 3001
```

---

### B7 — Deploy All to Production

```bash
# Namespace + secrets
kubectl apply -f k8s-local/namespace.yaml
# (create secrets as per B1)

# Infrastructure (Helm)
helm install nats   nats/nats             --namespace ainrider -f k8s-local/helm-values/nats-prod.yaml   --wait
helm install redis  bitnami/redis         --namespace ainrider -f k8s-local/helm-values/redis-prod.yaml  --wait
helm install postgres timescale/timescaledb-single --namespace ainrider ...                               --wait
kubectl apply -f k8s-local/pgbouncer.yaml

# Run Prisma migrations (after NestJS services are built)
kubectl run migration --image=ghcr.io/<org>/auth-service:latest --restart=Never \
  --namespace ainrider --env="DATABASE_URL=postgresql://ainrider:...@pgbouncer:5432/ainrider" \
  -- node dist/main migrate
kubectl delete pod migration -n ainrider

# Services + Ingress
kubectl apply -f k8s-local/services.yaml
kubectl apply -f k8s-local/ingress-prod.yaml

# Verify
kubectl get pods -n ainrider
kubectl get ingress -n ainrider
```

---

### Production Checklist

**Security**
- [ ] All secrets in `ainrider-secrets` K8s Secret, not hardcoded in YAML
- [ ] TLS enabled via cert-manager (B6)
- [ ] `imagePullPolicy: Always` with pinned image tags (not `:latest` in prod)
- [ ] Network policies restricting pod-to-pod traffic

**Scaling**
- [ ] HPA configured for api-gateway, websocket-server, location-service, match-service
- [ ] Redis Cluster mode (6 nodes)
- [ ] NATS 3-node cluster
- [ ] PostgreSQL with connection pooling via PgBouncer (2 replicas)

**Reliability**
- [ ] All services have `livenessProbe` + `readinessProbe` (already in services.yaml)
- [ ] Pod Disruption Budgets for stateful services
- [ ] PostgreSQL backup strategy (e.g. WAL-G to MinIO/S3)
- [ ] NATS stream retention configured (7 days, already in nats-client)

**Observability**
- [ ] Prometheus + Grafana scraping `/metrics` from all services
- [ ] Log aggregation (Loki or ELK)
- [ ] Alerting rules (CPU > 80%, error rate > 1%, pod restarts)

---

## Troubleshooting

**Pod stuck in `Pending`**

```bash
kubectl describe pod -n ainrider <pod-name>
# Usually: not enough RAM → increase Docker Desktop memory allocation
```

**`ImagePullBackOff` for ainrider/* images in k3d**

```bash
# Image not loaded into the cluster
bash scripts/k3d-build.sh <service-name>
```

**Ingress not routing (connection refused)**

```bash
# Check Windows hosts file
type C:\Windows\System32\drivers\etc\hosts | findstr ainrider

# Check nginx ingress pod is running
kubectl get pods -n ingress-nginx
```

**NATS connection refused inside pods**

```bash
# Services use DNS: nats://nats:4222 (resolves inside the cluster only)
kubectl get svc -n ainrider | grep nats
kubectl logs -n ainrider nats-0 | tail -20
```

**PostgreSQL TimescaleDB extensions missing**

```bash
# bitnami/postgresql does not include TimescaleDB by default.
# The init SQL in postgres.yaml will fail silently on the extension creation.
# For production: use timescale/timescaledb-ha chart (see B4).
# For local k3d dev: location history still writes, just without compression.
kubectl logs -n ainrider postgres-postgresql-0 | grep -i "extension"
```
