import Redis, { Cluster, ClusterOptions } from "ioredis";

export interface RedisClientLike {
  exists(key: string): Promise<number | boolean>;
  exists(keys: string[]): Promise<number | boolean>;
  setEx?(key: string, ttl: number, value: string): Promise<unknown>;
  setex?(key: string, ttl: number, value: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  set(key: string, value: string, flag: string, duration: number): Promise<unknown>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
  del(keys: string[]): Promise<number>;
  connect?(): unknown;
  disconnect?(): unknown;
  quit?(): unknown;
  readonly status?: string;
  readonly isOpen?: boolean;
}

export interface RedisClusterConfig {
  nodes: string[];
  password?: string;
  keyPrefix?: string;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
  natMap?: Record<string, { host: string; port: number }>;
}

function parseNatMap(raw?: string): Record<string, { host: string; port: number }> | undefined {
  if (!raw) return undefined;
  const map: Record<string, { host: string; port: number }> = {};
  for (const entry of raw.split(',')) {
    const [from, to] = entry.split('>');
    if (!from || !to) continue;
    const [fromHost, fromPort] = from.split(':');
    const [toHost, toPort] = to.split(':');
    map[`${fromHost}:${fromPort}`] = { host: toHost, port: parseInt(toPort, 10) };
  }
  return Object.keys(map).length > 0 ? map : undefined;
}

export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const nodes = config.nodes.map((node) => {
    const [host, port] = node.split(":");
    return { host, port: parseInt(port, 10) };
  });

  const envNatMap = parseNatMap(process.env.REDIS_NAT_MAP);
  const natMap = config.natMap ?? envNatMap;

  const options: ClusterOptions = {
    natMap,
    redisOptions: {
      password: config.password,
      keyPrefix: config.keyPrefix,
      enableReadyCheck: config.enableReadyCheck ?? true,
      maxRetriesPerRequest: config.maxRetriesPerRequest ?? 3,
    },
    clusterRetryStrategy: (times: number) => {
      const delay = Math.min(100 + times * 100, 2000);
      console.log(`[Redis Cluster] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
  };

  const cluster = new Redis.Cluster(nodes, options);

  cluster.on("connect", () => {
    console.log("[Redis Cluster] Connected");
  });

  cluster.on("ready", () => {
    console.log("[Redis Cluster] Ready");
  });

  cluster.on("error", (err) => {
    console.error("[Redis Cluster] Error:", err);
  });

  cluster.on("close", () => {
    console.log("[Redis Cluster] Connection closed");
  });

  cluster.on("reconnecting", () => {
    console.log("[Redis Cluster] Reconnecting...");
  });

  cluster.on("end", () => {
    console.log("[Redis Cluster] Connection ended");
  });

  return cluster;
}
