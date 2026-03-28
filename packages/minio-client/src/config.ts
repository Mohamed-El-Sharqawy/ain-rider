export interface StorageConfig {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  region: string;
  defaultBucket: string;
  presignedUrlTtlSeconds: number;
}

export function loadStorageConfig(): StorageConfig {
  return {
    endPoint: process.env.MINIO_ENDPOINT ?? "minio",
    port: parseInt(process.env.MINIO_PORT ?? "9000", 10),
    useSSL: process.env.MINIO_USE_SSL === "true",
    accessKey: process.env.MINIO_ACCESS_KEY ?? "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY ?? "minioadmin",
    region: process.env.MINIO_REGION ?? "us-east-1",
    defaultBucket: process.env.MINIO_DEFAULT_BUCKET ?? "ain-rider",
    presignedUrlTtlSeconds: parseInt(
      process.env.MINIO_PRESIGNED_TTL ?? "3600",
      10,
    ),
  };
}
