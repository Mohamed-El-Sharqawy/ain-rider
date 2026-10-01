/**
 * Test environment defaults for the ain-rider backend.
 *
 * All defaults match the infra defined in apps/backend/docker-compose.yml
 * (postgres on 5433, redis cluster on 6379-6384, nats on 4222-4224,
 * minio on 9000). Existing process env values always win, so CI can
 * override any of them.
 *
 * Idempotent: call loadTestEnv() as often as you like.
 */

export interface TestEnv {
  postgresHost: string;
  postgresPort: number;
  postgresUser: string;
  postgresPassword: string;
  redisNodes: string[];
  natsServers: string[];
  minioEndpoint: string;
  minioPort: number;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioRegion: string;
}

const DEFAULTS: Record<string, string> = {
  POSTGRES_HOST: "localhost",
  POSTGRES_PORT: "5433",
  POSTGRES_USER: "ainrider",
  POSTGRES_PASSWORD: "password",
  REDIS_NODES:
    "localhost:6379,localhost:6380,localhost:6381,localhost:6382,localhost:6383,localhost:6384",
  REDIS_NAT_MAP:
    "ain-rider-redis-1:6379>localhost:6379," +
    "ain-rider-redis-2:6379>localhost:6380," +
    "ain-rider-redis-3:6379>localhost:6381," +
    "ain-rider-redis-4:6379>localhost:6382," +
    "ain-rider-redis-5:6379>localhost:6383," +
    "ain-rider-redis-6:6379>localhost:6384",
  NATS_SERVERS:
    "nats://localhost:4222,nats://localhost:4223,nats://localhost:4224",
  // JetStream publish acks wait 5s by default; CI file storage can exceed
  // it, so suites that publish through JetStream get a wider margin.
  NATS_JS_TIMEOUT_MS: "30000",
  MINIO_ENDPOINT: "localhost",
  MINIO_PORT: "9000",
  MINIO_ACCESS_KEY: "minioadmin",
  MINIO_SECRET_KEY: "minioadmin",
  MINIO_BUCKET: "ain-rider-test",
  MINIO_REGION: "us-east-1",
};

/** Apply test env defaults (existing values win) and return the parsed env. */
export function loadTestEnv(): TestEnv {
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }

  return {
    postgresHost: process.env.POSTGRES_HOST!,
    postgresPort: parseInt(process.env.POSTGRES_PORT!, 10),
    postgresUser: process.env.POSTGRES_USER!,
    postgresPassword: process.env.POSTGRES_PASSWORD!,
    redisNodes: process.env.REDIS_NODES!.split(",").map((n) => n.trim()),
    natsServers: process.env.NATS_SERVERS!.split(",").map((n) => n.trim()),
    minioEndpoint: process.env.MINIO_ENDPOINT!,
    minioPort: parseInt(process.env.MINIO_PORT!, 10),
    minioAccessKey: process.env.MINIO_ACCESS_KEY!,
    minioSecretKey: process.env.MINIO_SECRET_KEY!,
    minioBucket: process.env.MINIO_BUCKET!,
    minioRegion: process.env.MINIO_REGION!,
  };
}
