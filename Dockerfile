# ─────────────────────────────────────────────
# Stage 1: Development (Metro bundler)
# ─────────────────────────────────────────────
FROM node:20-alpine AS development

WORKDIR /app

# System deps needed by some native modules
RUN apk add --no-cache bash curl git

# Install dependencies first (layer cache)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy project source
COPY . .

# Expo dev-tools & Metro
EXPOSE 8081 19000 19001 19002

ENV EXPO_DEVTOOLS_LISTEN_ADDRESS=0.0.0.0

CMD ["npx", "expo", "start", "--web", "--port", "8081"]


# ─────────────────────────────────────────────
# Stage 2: Build (web production bundle)
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache bash curl git

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

RUN npx expo export --platform web --output-dir /app/dist


# ─────────────────────────────────────────────
# Stage 3: Production (serve web build via nginx)
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

COPY --from=builder /app/dist /usr/share/nginx/html

# Custom nginx config for SPA routing
RUN printf 'server {\n\
  listen 80;\n\
  root /usr/share/nginx/html;\n\
  index index.html;\n\
  location / {\n\
    try_files $uri $uri/ /index.html;\n\
  }\n\
}\n' > /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
