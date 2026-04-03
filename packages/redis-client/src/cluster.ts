import Redis, { Cluster, ClusterOptions } from "ioredis";

export interface RedisClusterConfig {
  nodes: string[]; // ["host:port", "host:port", ...]
  password?: string;
  keyPrefix?: string;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
}

export function createRedisCluster(config: RedisClusterConfig): Cluster {
  const nodes = config.nodes.map((node) => {
    const [host, port] = node.split(":");
    return { host, port: parseInt(port, 10) };
  });

  const options: ClusterOptions = {
    natMap: {
      // 3 masters - local development
      "ain-rider-redis-1:6379": { host: "127.0.0.1", port: 6379 },
      "ain-rider-redis-1:0":    { host: "127.0.0.1", port: 6379 },
      "ain-rider-redis-2:6379": { host: "127.0.0.1", port: 6380 },
      "ain-rider-redis-2:0":    { host: "127.0.0.1", port: 6380 },
      "ain-rider-redis-3:6379": { host: "127.0.0.1", port: 6381 },
      "ain-rider-redis-3:0":    { host: "127.0.0.1", port: 6381 },
      // 3 replicas - local development
      "ain-rider-redis-4:6379": { host: "127.0.0.1", port: 6382 },
      "ain-rider-redis-4:0":    { host: "127.0.0.1", port: 6382 },
      "ain-rider-redis-5:6379": { host: "127.0.0.1", port: 6383 },
      "ain-rider-redis-5:0":    { host: "127.0.0.1", port: 6383 },
      "ain-rider-redis-6:6379": { host: "127.0.0.1", port: 6384 },
      "ain-rider-redis-6:0":    { host: "127.0.0.1", port: 6384 },
    },
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
