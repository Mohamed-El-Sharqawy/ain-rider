import { Injectable, OnModuleInit, Logger, InternalServerErrorException } from '@nestjs/common';
import { Client, type BucketItem } from 'minio';
import { Readable } from 'stream';
import { loadStorageConfig, type StorageConfig } from './storage.config';

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

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Client;
  private readonly config: StorageConfig;

  constructor() {
    this.config = loadStorageConfig();
    this.client = new Client({
      endPoint: this.config.endPoint,
      port: this.config.port,
      useSSL: this.config.useSSL,
      accessKey: this.config.accessKey,
      secretKey: this.config.secretKey,
      region: this.config.region,
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucketExists(this.config.defaultBucket);
  }

  /**
   * Upload a Buffer or Readable stream to MinIO.
   * Returns the public-facing object URL (internal hostname for service-to-service calls).
   */
  async upload(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    const bucket = options.bucket ?? this.config.defaultBucket;
    const contentType = options.contentType ?? 'application/octet-stream';
    const metadata: Record<string, string> = {
      'Content-Type': contentType,
      ...options.metadata,
    };

    try {
      const result = await this.client.putObject(bucket, objectName, data, size, metadata);
      const url = this.buildObjectUrl(bucket, objectName);

      this.logger.log(
        JSON.stringify({
          level: 'info',
          service: 'admin-service',
          message: 'Object uploaded',
          bucket,
          objectName,
          size,
          etag: result.etag,
        }),
      );

      return { bucket, objectName, etag: result.etag, size, url };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          service: 'admin-service',
          message: 'Upload failed',
          bucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException('File upload failed');
    }
  }

  /**
   * Generate a presigned GET URL for secure, time-limited object access.
   * Never expose the internal MinIO endpoint directly to clients.
   */
  async getPresignedGetUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const ttl = ttlSeconds ?? this.config.presignedUrlTtlSeconds;

    try {
      const url = await this.client.presignedGetObject(targetBucket, objectName, ttl);
      const expiresAt = new Date(Date.now() + ttl * 1000);
      return { url, expiresAt };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          service: 'admin-service',
          message: 'Presigned GET URL generation failed',
          bucket: targetBucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException('Failed to generate presigned URL');
    }
  }

  /**
   * Generate a presigned PUT URL for direct client-to-MinIO uploads.
   * The client uploads directly — the service never buffers the file body.
   * This is the preferred pattern for large files at scale.
   */
  async getPresignedPutUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const ttl = ttlSeconds ?? this.config.presignedUrlTtlSeconds;

    try {
      const url = await this.client.presignedPutObject(targetBucket, objectName, ttl);
      const expiresAt = new Date(Date.now() + ttl * 1000);
      return { url, expiresAt };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          service: 'admin-service',
          message: 'Presigned PUT URL generation failed',
          bucket: targetBucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException('Failed to generate presigned upload URL');
    }
  }

  /**
   * Delete an object from MinIO.
   */
  async delete(objectName: string, bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;

    try {
      await this.client.removeObject(targetBucket, objectName);
      this.logger.log(
        JSON.stringify({
          level: 'info',
          service: 'admin-service',
          message: 'Object deleted',
          bucket: targetBucket,
          objectName,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          service: 'admin-service',
          message: 'Object deletion failed',
          bucket: targetBucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException('File deletion failed');
    }
  }

  /**
   * Delete multiple objects in a single MinIO call.
   * Preferred over looping delete() for batch operations.
   */
  async deleteMany(objectNames: string[], bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const objects = objectNames.map((name) => ({ name }));

    try {
      await this.client.removeObjects(targetBucket, objects);
      this.logger.log(
        JSON.stringify({
          level: 'info',
          service: 'admin-service',
          message: 'Batch objects deleted',
          bucket: targetBucket,
          count: objectNames.length,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: 'error',
          service: 'admin-service',
          message: 'Batch deletion failed',
          bucket: targetBucket,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException('Batch file deletion failed');
    }
  }

  /**
   * List all objects under a given prefix (folder equivalent).
   */
  async listObjects(prefix: string, bucket?: string): Promise<ListObjectsResult[]> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const results: ListObjectsResult[] = [];

    return new Promise((resolve, reject) => {
      const stream = this.client.listObjects(targetBucket, prefix, true);

      stream.on('data', (obj: BucketItem) => {
        if (obj.name) {
          results.push({
            objectName: obj.name,
            size: obj.size ?? 0,
            lastModified: obj.lastModified ?? new Date(),
            etag: obj.etag ?? '',
          });
        }
      });

      stream.on('error', (err: Error) => {
        this.logger.error(
          JSON.stringify({
            level: 'error',
            service: 'admin-service',
            message: 'List objects failed',
            bucket: targetBucket,
            prefix,
            error: err.message,
          }),
        );
        reject(new InternalServerErrorException('Failed to list objects'));
      });

      stream.on('end', () => resolve(results));
    });
  }

  /**
   * Check if an object exists.
   */
  async exists(objectName: string, bucket?: string): Promise<boolean> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    try {
      await this.client.statObject(targetBucket, objectName);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Ping MinIO — used by the health check.
   */
  async ping(): Promise<boolean> {
    try {
      await this.client.listBuckets();
      return true;
    } catch {
      return false;
    }
  }

  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, this.config.region);
        this.logger.log(
          JSON.stringify({
            level: 'info',
            service: 'admin-service',
            message: 'Bucket created',
            bucket,
            region: this.config.region,
          }),
        );
      }
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          level: 'warn',
          service: 'admin-service',
          message: 'Could not verify/create bucket — MinIO may not be available yet',
          bucket,
          error: String(error),
        }),
      );
    }
  }

  private buildObjectUrl(bucket: string, objectName: string): string {
    const scheme = this.config.useSSL ? 'https' : 'http';
    const port =
      (this.config.useSSL && this.config.port === 443) ||
      (!this.config.useSSL && this.config.port === 80)
        ? ''
        : `:${this.config.port}`;
    return `${scheme}://${this.config.endPoint}${port}/${bucket}/${objectName}`;
  }
}
