FROM oven/bun:1.1-alpine AS builder
WORKDIR /app

COPY package.json bun.lockb* ./
COPY src ./src
COPY tsconfig.json ./

RUN bun install --frozen-lockfile --production

FROM oven/bun:1.1-alpine
WORKDIR /app

RUN addgroup -S ainrider && adduser -S ainrider -G ainrider

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/tsconfig.json ./
COPY package.json ./

USER ainrider

EXPOSE 3000
ENV NODE_ENV=production

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["bun", "run", "src/index.ts"]
