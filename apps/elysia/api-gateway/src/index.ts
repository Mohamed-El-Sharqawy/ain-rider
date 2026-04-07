import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import { cookie } from "@elysiajs/cookie";
import { rateLimit } from "elysia-rate-limit";
import { health } from "./modules/health";
import { metrics } from "./modules/metrics";
import { auth } from "./modules/auth";
import { trips } from "./modules/trips";
import { locationProxy } from "./modules/location";
import { matchProxy } from "./modules/match";
import { admin } from "./modules/admin";
import { support } from "./modules/support";
import { settings } from "./modules/settings";
import { log } from "./shared/logger";
import { internalCallsTotal } from "@ain-rider/metrics";
import { configureFetchInternal } from "@ain-rider/internal-api";
import {
  AppError,
  normalizeError,
  logError,
  createLogger,
  ValidationError,
  InternalError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  generateTraceId,
  extractTraceId,
} from "@ain-rider/error-handling";

import type { FetchInternalConfig } from "@ain-rider/internal-api";

const fetchInternalConfig: FetchInternalConfig = {
  serviceName: 'api-gateway',
  metrics: {
    inc: (labels: { service: string; status: string }) =>
      internalCallsTotal.inc({
        source_service: 'api-gateway',
        target_service: labels.service,
        method: 'unknown',
        status: labels.status
      })
  },
  logger: {
    error: (message: string, meta?: Record<string, unknown>) => {
      log('error', message, meta);
    },
  },
};
configureFetchInternal(fetchInternalConfig);

const PORT = parseInt(process.env.API_GATEWAY_PORT || "3000");
const allowedOrigins = process.env.CORS_ORIGIN?.split(",") ?? [
  "http://localhost:5173",
];
const logger = createLogger({ serviceName: "api-gateway" });

new Elysia()
  .use(cookie())
  .state("traceId", "unknown")
  .onRequest(({ request, store }) => {
    const headers = request.headers as unknown as Record<string, string>;
    const traceId = extractTraceId(headers) || generateTraceId();
    store.traceId = traceId;
  })
  .onError(({ code, error, set, store }) => {
    const traceId = (store as any).traceId || "unknown";

    let appError: AppError;
    const errorCode = code as string | number;

    if (errorCode === "NOT_FOUND") {
      appError = new NotFoundError("Resource");
    } else if (errorCode === "VALIDATION") {
      const validationError = error as any;
      appError = new ValidationError(
        validationError.summary || "Validation failed",
        {
          errors: validationError.errors,
          type: validationError.type,
        },
      );
    } else if (typeof errorCode === "number") {
      const message =
        typeof error === "string"
          ? error
          : (error as any)?.message || "Request failed";
      switch (errorCode) {
        case 401:
          appError = new UnauthorizedError(message);
          break;
        case 403:
          appError = new ForbiddenError(message);
          break;
        case 404:
          appError = new NotFoundError(message);
          break;
        case 429:
          appError = new InternalError("RATE_LIMIT_EXCEEDED: " + message, {
            status: errorCode,
          });
          break;
        case 400:
        default:
          appError = new ValidationError(message, { status: errorCode });
      }
    } else {
      appError = normalizeError(error);
    }

    logError(logger, appError, { traceId });

    set.status = appError.httpStatus;
    return appError.toResponse(traceId);
  })
  .use(
    cors({
      origin: (request) => {
        const origin = request.headers.get("origin");
        if (
          !origin ||
          allowedOrigins.includes(origin) ||
          allowedOrigins.includes("*")
        ) {
          return true;
        }
        return false;
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    }),
  )
  .use(
    swagger({
      documentation: {
        info: { title: "911 Ain Rider API Gateway", version: "1.0.0" },
        components: {
          securitySchemes: {
            cookieAuth: { type: "apiKey", in: "cookie", name: "accessToken" },
          },
        },
      },
    }),
  )
  .use(
    rateLimit({
      duration: 60_000,
      max: 200,
      generator: (req) =>
        req.headers.get("x-forwarded-for") ||
        req.headers.get("x-real-ip") ||
        "anonymous",
    }),
  )
  .use(health)
  .use(metrics)
  .use(auth)
// ... (rest)

  .use(trips)
  .use(locationProxy)
  .use(matchProxy)
  .use(admin)
  .use(support)
  .use(settings)
  .listen(PORT);

log("info", `API Gateway running`, { port: PORT });
log("info", `Swagger docs available`, {
  url: `http://localhost:${PORT}/swagger`,
});
