FROM node:22-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@10.15.1

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages ./packages
COPY apps/nest/auth-service ./apps/nest/auth-service

RUN pnpm install --frozen-lockfile

RUN pnpm --filter @ain-rider/shared-types build
RUN pnpm --filter @ain-rider/nats-client  build
RUN pnpm --filter @ain-rider/redis-client build

WORKDIR /app/apps/nest/auth-service
RUN pnpm prisma:generate
RUN pnpm build

FROM node:22-alpine
WORKDIR /app

RUN addgroup -S ainrider && adduser -S ainrider -G ainrider

COPY --from=builder /app/apps/nest/auth-service/dist     ./dist
COPY --from=builder /app/apps/nest/auth-service/node_modules ./node_modules
COPY --from=builder /app/apps/nest/auth-service/prisma   ./prisma
COPY apps/nest/auth-service/package.json ./

USER ainrider
EXPOSE 4000
CMD ["node", "dist/main.js"]
