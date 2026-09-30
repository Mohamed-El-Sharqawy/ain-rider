import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { Readable } from "stream";
import {
  StorageClient,
  type UploadOptions,
  type UploadResult,
  type PresignedUrlResult,
  type ListObjectsResult,
} from "@ain-rider/minio-client";

export type {
  UploadOptions,
  UploadResult,
  PresignedUrlResult,
  ListObjectsResult,
};

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: StorageClient;

  constructor() {
    this.client = new StorageClient({ serviceName: "admin-service" });
  }

  async onModuleInit(): Promise<void> {
    await this.client.initialize();
  }

  async upload(
    objectName: string,
    data: Buffer | Readable,
    size: number,
    options: UploadOptions = {},
  ): Promise<UploadResult> {
    try {
      return await this.client.upload(objectName, data, size, options);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "Upload failed",
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("File upload failed");
    }
  }

  async getPresignedGetUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    try {
      return await this.client.getPresignedGetUrl(
        objectName,
        ttlSeconds,
        bucket,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "Presigned GET URL generation failed",
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException(
        "Failed to generate presigned URL",
      );
    }
  }

  async getPresignedPutUrl(
    objectName: string,
    ttlSeconds?: number,
    bucket?: string,
  ): Promise<PresignedUrlResult> {
    try {
      return await this.client.getPresignedPutUrl(
        objectName,
        ttlSeconds,
        bucket,
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "Presigned PUT URL generation failed",
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException(
        "Failed to generate presigned upload URL",
      );
    }
  }

  async delete(objectName: string, bucket?: string): Promise<void> {
    try {
      await this.client.delete(objectName, bucket);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "Object deletion failed",
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("File deletion failed");
    }
  }

  async deleteMany(objectNames: string[], bucket?: string): Promise<void> {
    try {
      await this.client.deleteMany(objectNames, bucket);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "Batch deletion failed",
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("Batch file deletion failed");
    }
  }

  async listObjects(
    prefix: string,
    bucket?: string,
  ): Promise<ListObjectsResult[]> {
    try {
      return await this.client.listObjects(prefix, bucket);
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "admin-service",
          message: "List objects failed",
          prefix,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("Failed to list objects");
    }
  }

  async exists(objectName: string, bucket?: string): Promise<boolean> {
    return this.client.exists(objectName, bucket);
  }

  async ping(): Promise<boolean> {
    return this.client.ping();
  }
}
