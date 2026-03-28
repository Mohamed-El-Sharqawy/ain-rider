import { Client, type BucketItem } from "minio";
import { Readable } from "stream";
import { loadStorageConfig, type StorageConfig } from "./config";

export interface UploadOptions {
  bucket?: string;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface UploadResult {
  bucket: string;
  objectName: string;
  etag: string;
  size: number;
  url: string;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface ListObjectsResult {
  objectName: string;
  size: number;
  lastModified: Date;
  etag: string;
}

export interface StorageClientOptions {
  serviceName?: string;
}

export class StorageClient {
  private client: Client;
  private readonly config: StorageConfig;
  private readonly serviceName: string;

  constructor(options: StorageClientOptions = {}) {
    this.config = loadStorageConfig();
    this.serviceName = options.serviceName ?? "unknown-service";
    this.client = new Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      region: this.config.region,
    });
  }

  async initialize(): Promise<void> {
    await this.ensureBucketExists(this.config.defaultBucket);
  }

  async upload(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const bucket = options.bucket ?? this.config.defaultBucket;
    const contentType = options.contentType ?? "application/octet-stream";
    const metadata: Record<string, string> = {
      "Content-Type": contentType,
      ...options.metadata,
    };

    const result = await this.client.putObject(
      bucket,
      objectName,
      data,
      size,
      metadata,
    );
    const url = this.buildObjectUrl(bucket, objectName);

    this.log("info", "Object uploaded", {
      bucket,
      objectName,
      size,
      etag: result.etag,
    });

    return { bucket, objectName, etag: result.etag, size, url };
  }

  async uploadMultiple(
    files: Array<{ objectName: string; data: Buffer; contentType?: string }>,
    options: UploadOptions = {},
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      const result = await this.upload(
        file.objectName,
        file.data,
        file.data.length,
        { ...options, contentType: file.contentType },
      );
      results.push(result);
    }
    return results;
  }

  async getPresignedGetUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const ttl = ttlSeconds ?? this.config.presignedUrlTtlSeconds;

    const url = await this.client.presignedGetObject(
      targetBucket,
      objectName,
      ttl,
    );
    const expiresAt = new Date(Date.now() + ttl * 1000);
    return { url, expiresAt };
  }

  async getPresignedUrlsForObjectKeys(
    objectNames: string[],
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult[]> {
    const results: PresignedUrlResult[] = [];
    for (const objectName of objectNames) {
      const result = await this.getPresignedGetUrl(
        objectName,
        ttlSeconds,
        bucket,
      );
      results.push(result);
    }
    return results;
  }

  async getPresignedPutUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const ttl = ttlSeconds ?? this.config.presignedUrlTtlSeconds;

    const url = await this.client.presignedPutObject(
      targetBucket,
      objectName,
      ttl,
    );
    const expiresAt = new Date(Date.now() + ttl * 1000);
    return { url, expiresAt };
  }

  async delete(objectName: string, bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    await this.client.removeObject(targetBucket, objectName);
    this.log("info", "Object deleted", { bucket: targetBucket, objectName });
  }

  async deleteMany(objectNames: string[], bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const objects = objectNames.map((name) => ({ name }));
    await this.client.removeObjects(targetBucket, objects);
    this.log("info", "Batch objects deleted", {
      bucket: targetBucket,
      count: objectNames.length,
    });
  }

  async listObjects(
    prefix: string,
    bucket?: string,
  ): Promise<ListObjectsResult[]> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const results: ListObjectsResult[] = [];

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjects(targetBucket, prefix, true);

      stream.on("data", (obj: BucketItem) => {
        if (obj.name) {
          results.push({
            objectName: obj.name,
            size: obj.size ?? 0,
            lastModified: obj.lastModified ?? new Date(),
            etag: obj.etag ?? "",
          });
        }
      });

      stream.on("error", (err: Error) => {
        this.log("error", "List objects failed", {
          bucket: targetBucket,
          prefix,
          error: err.message,
        });
        reject(err);
      });

      stream.on("end", () => resolve(results));
    });
  }

  async exists(objectName: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    try {
      await this.client.statObject(targetBucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  async ping(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  getConfig(): StorageConfig {
    return this.config;
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, this.config.region);
        this.log("info", "Bucket created", {
          bucket,
          region: this.config.region,
        });
      }
    } catch (error) {
      this.log(
        "warn",
        "Could not verify/create bucket — MinIO may not be available yet",
        {
          bucket,
          error: String(error),
        },
      );
    }
  }

  private buildObjectUrl(bucket: string, objectName: string): string {
    const scheme = this.config.useSSL ? "https" : "http";
    const port =
      (this.config.useSSL && this.config.port === 443) ||
      (!this.config.useSSL && this.config.port === 80)
        ? ""
        : `:${this.config.port}`;
    return `${scheme}://${this.config.endPoint}${port}/${bucket}/${objectName}`;
  }

  private log(
    level: string,
    message: string,
    data: Record<string, unknown>,
  ): void {
    console.log(
      JSON.stringify({
        level,
        service: this.serviceName,
        message,
        ...data,
      }),
    );
  }
}
