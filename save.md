# Tasks: Driver & Rider Onboarding

**Input**: Design documents from `/specs/005-driver-rider-onboarding/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.yaml

**Tests**: NOT included - not explicitly requested in specification.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

All paths are relative to repository root `D:\Work\ain-rider\backend\`:

- **auth-service**: `apps/nest/auth-service/src/`
- **shared-types**: `packages/shared-types/src/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Prisma schema updates and shared module creation

### T001: Update Prisma Schema - Add Enums and Models

**File**: `apps/nest/auth-service/prisma/schema.prisma`

**Action**: Add the following to the END of the existing schema file:

```prisma
enum OnboardingStatus {
  PENDING_DOCUMENTS
  UNDER_REVIEW
  APPROVED
  REJECTED
}

enum DocumentStatus {
  PENDING
  APPROVED
  REJECTED
}

model DriverDocument {
  id                            String          @id @default(uuid())
  driverId                      String          @unique
  identityImages                String[]
  identityStatus                DocumentStatus  @default(PENDING)
  identityRejectionReason       String?
  identityUploadAttempts        Int             @default(0)
  drivingLicenseImages          String[]
  drivingLicenseStatus          DocumentStatus  @default(PENDING)
  drivingLicenseRejectionReason String?
  drivingLicenseUploadAttempts  Int             @default(0)
  createdAt                     DateTime        @default(now())
  updatedAt                     DateTime        @updatedAt

  driver Driver @relation(fields: [driverId], references: [id], onDelete: Cascade)

  @@index([identityStatus])
  @@index([drivingLicenseStatus])
  @@map("driver_documents")
}

model Vehicle {
  id               String         @id @default(uuid())
  make             String
  model            String
  year             Int
  color            String
  plateNumber      String         @unique
  carImage         String
  carLicenseImage  String
  carLicenseText   String?
  status           DocumentStatus @default(PENDING)
  rejectionReason  String?
  uploadAttempts   Int            @default(0)
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt

  drivers Driver[]

  @@index([status])
  @@map("vehicles")
}
```

**Then modify the Driver model**:

- REMOVE the `isOnline Boolean @default(false)` line
- ADD `onboardingStatus OnboardingStatus @default(PENDING_DOCUMENTS)` after totalTrips
- ADD `document DriverDocument?` relation
- ADD `vehicle Vehicle? @relation(fields: [vehicleId], references: [id], onDelete: SetNull)` relation

**Example Driver model after changes**:

```prisma
model Driver {
  id               String            @id @default(uuid())
  userId           String            @unique
  vehicleId        String?
  licenseNumber    String            @unique
  rating           Float             @default(5.0)
  totalTrips       Int               @default(0)
  onboardingStatus OnboardingStatus  @default(PENDING_DOCUMENTS)
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  user    User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  vehicle Vehicle?        @relation(fields: [vehicleId], references: [id], onDelete: SetNull)
  document DriverDocument?

  @@map("drivers")
}
```

- [ ] T001 Update Prisma schema with enums, DriverDocument, Vehicle models, and modify Driver model in `apps/nest/auth-service/prisma/schema.prisma`

---

### T002: Run Prisma Migration

**Action**: After T001 is complete, run these commands:

```bash
cd apps/nest/auth-service
npx prisma migrate dev --name add_driver_onboarding_models
npx prisma generate
```

- [ ] T002 Run Prisma migration and generate client after T001 is complete

---

### T003: Create Storage Config

**File**: `apps/nest/auth-service/src/shared/storage/storage.config.ts`

**Action**: Create directory `apps/nest/auth-service/src/shared/storage/` if it doesn't exist, then create this file:

```typescript
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
```

- [ ] T003 [P] Create storage config in `apps/nest/auth-service/src/shared/storage/storage.config.ts`

---

### T004: Create Storage Service

**File**: `apps/nest/auth-service/src/shared/storage/storage.service.ts`

**Action**: Create the MinIO storage service with upload, presigned URL, and delete capabilities:

```typescript
import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from "@nestjs/common";
import { Client, type BucketItem } from "minio";
import { Readable } from "stream";
import { loadStorageConfig, type StorageConfig } from "./storage.config";

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

    try {
      const result = await this.client.putObject(
        bucket,
        objectName,
        data,
        size,
        metadata,
      );
      const url = this.buildObjectUrl(bucket, objectName);

      this.logger.log(
        JSON.stringify({
          level: "info",
          service: "auth-service",
          message: "Object uploaded",
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
          level: "error",
          service: "auth-service",
          message: "Upload failed",
          bucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("File upload failed");
    }
  }

  async uploadMultiple(
    files: Array<{ name: string; data: Buffer; contentType: string }>,
    prefix: string,
  ): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    for (const file of files) {
      const objectName = `${prefix}/${file.name}`;
      const result = await this.upload(
        objectName,
        file.data,
        file.data.length,
        {
          contentType: file.contentType,
        },
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

    try {
      const url = await this.client.presignedGetObject(
        targetBucket,
        objectName,
        ttl,
      );
      const expiresAt = new Date(Date.now() + ttl * 1000);
      return { url, expiresAt };
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "auth-service",
          message: "Presigned GET URL generation failed",
          bucket: targetBucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException(
        "Failed to generate presigned URL",
      );
    }
  }

  async getPresignedUrlsForObjectKeys(
    objectKeys: string[],
    ttlSeconds?: number,
  ): Promise<PresignedUrlResult[]> {
    const results: PresignedUrlResult[] = [];
    for (const key of objectKeys) {
      const result = await this.getPresignedGetUrl(key, ttlSeconds);
      results.push(result);
    }
    return results;
  }

  async delete(objectName: string, bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;

    try {
      await this.client.removeObject(targetBucket, objectName);
      this.logger.log(
        JSON.stringify({
          level: "info",
          service: "auth-service",
          message: "Object deleted",
          bucket: targetBucket,
          objectName,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "auth-service",
          message: "Object deletion failed",
          bucket: targetBucket,
          objectName,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("File deletion failed");
    }
  }

  async deleteMany(objectNames: string[], bucket?: string): Promise<void> {
    const targetBucket = bucket ?? this.config.defaultBucket;
    const objects = objectNames.map((name) => ({ name }));

    try {
      await this.client.removeObjects(targetBucket, objects);
      this.logger.log(
        JSON.stringify({
          level: "info",
          service: "auth-service",
          message: "Batch objects deleted",
          bucket: targetBucket,
          count: objectNames.length,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "auth-service",
          message: "Batch deletion failed",
          bucket: targetBucket,
          error: String(error),
        }),
      );
      throw new InternalServerErrorException("Batch file deletion failed");
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

  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      const exists = await this.client.bucketExists(bucket);
      if (!exists) {
        await this.client.makeBucket(bucket, this.config.region);
        this.logger.log(
          JSON.stringify({
            level: "info",
            service: "auth-service",
            message: "Bucket created",
            bucket,
            region: this.config.region,
          }),
        );
      }
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          level: "warn",
          service: "auth-service",
          message: "Could not verify/create bucket",
          bucket,
          error: String(error),
        }),
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
}
```

- [ ] T004 [P] Create storage service in `apps/nest/auth-service/src/shared/storage/storage.service.ts`

---

### T005: Create Storage Module

**File**: `apps/nest/auth-service/src/shared/storage/storage.module.ts`

**Action**: Create the NestJS module:

```typescript
import { Module } from "@nestjs/common";
import { StorageService } from "./storage.service";

@Module({
  providers: [StorageService],
  exports: [StorageService],
})
export class StorageModule {}
```

- [ ] T005 [P] Create storage module in `apps/nest/auth-service/src/shared/storage/storage.module.ts`

---

### T006: Create Driver Guard

**File**: `apps/nest/auth-service/src/auth/guards/driver.guard.ts`

**Action**: Create directory `apps/nest/auth-service/src/auth/guards/` if needed, then create:

```typescript
import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class DriverGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    if (user.role !== "DRIVER") {
      throw new ForbiddenException("Driver access required");
    }

    return true;
  }
}
```

- [ ] T006 [P] Create driver guard in `apps/nest/auth-service/src/auth/guards/driver.guard.ts`

---

### T007: Create Rider Guard

**File**: `apps/nest/auth-service/src/auth/guards/rider.guard.ts`

**Action**: Create the rider role guard:

```typescript
import {
  Injectable,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class RiderGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    if (user.role !== "RIDER") {
      throw new ForbiddenException("Rider access required");
    }

    return true;
  }
}
```

- [ ] T007 [P] Create rider guard in `apps/nest/auth-service/src/auth/guards/rider.guard.ts`

---

### T008: Add DRIVER_APPROVED Event to Shared Types

**File**: `packages/shared-types/src/events.types.ts`

**Action**:

1. Find the `NATS_SUBJECTS` object and ADD this line inside it:

```typescript
DRIVER_APPROVED: 'ain_rider.driver.approved',
```

2. ADD this interface after the existing event interfaces (around line 200):

```typescript
export interface DriverApprovedEvent {
  subject: typeof NATS_SUBJECTS.DRIVER_APPROVED;
  data: {
    driverId: string;
    userId: string;
    vehicleId: string | null;
    timestamp: string;
  };
}
```

3. ADD `DriverApprovedEvent` to the `NatsEvent` union type at the end of the file.

- [ ] T008 [P] Add DRIVER_APPROVED event subject and interface in `packages/shared-types/src/events.types.ts`

---

### T009: Create Driver Event Publisher

**File**: `apps/nest/auth-service/src/events/driver-event.publisher.ts`

**Action**: Create directory if needed, then create:

```typescript
import { Injectable, Logger } from "@nestjs/common";
import { NatsService } from "../shared/nats/nats.service";
import { NATS_SUBJECTS } from "@ain-rider/shared-types";

export interface DriverApprovedPayload {
  driverId: string;
  userId: string;
  vehicleId: string | null;
}

@Injectable()
export class DriverEventPublisher {
  private readonly logger = new Logger(DriverEventPublisher.name);

  constructor(private nats: NatsService) {}

  async publishDriverApproved(payload: DriverApprovedPayload): Promise<void> {
    const event = {
      subject: NATS_SUBJECTS.DRIVER_APPROVED,
      data: {
        ...payload,
        timestamp: new Date().toISOString(),
      },
    };

    try {
      await this.nats.publisher.publish(
        NATS_SUBJECTS.DRIVER_APPROVED,
        event.data,
      );
      this.logger.log(
        JSON.stringify({
          level: "info",
          service: "auth-service",
          message: "Driver approved event published",
          driverId: payload.driverId,
          userId: payload.userId,
        }),
      );
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          level: "error",
          service: "auth-service",
          message: "Failed to publish driver approved event",
          driverId: payload.driverId,
          error: String(error),
        }),
      );
      throw error;
    }
  }
}
```

- [ ] T009 Create driver event publisher in `apps/nest/auth-service/src/events/driver-event.publisher.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core module setup that MUST be complete before ANY user story implementation

**CRITICAL**: No user story work can begin until this phase is complete

### T010: Create Update Driver Profile DTO

**File**: `apps/nest/auth-service/src/driver-onboarding/dto/update-driver-profile.dto.ts`

**Action**: Create directory `apps/nest/auth-service/src/driver-onboarding/dto/` if needed, then create:

```typescript
import {
  IsString,
  IsOptional,
  MaxLength,
  IsDateString,
  Matches,
} from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

export class UpdateDriverProfileDto {
  @ApiPropertyOptional({
    example: "123 Main St, City, Country",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string;

  @ApiPropertyOptional({ example: "John Doe", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  emergencyContactName?: string;

  @ApiPropertyOptional({ example: "+1234567890" })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format" })
  emergencyContactPhone?: string;

  @ApiPropertyOptional({ example: "1990-01-15" })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: "New York", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: "NY", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({ example: "USA", maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;
}
```

- [ ] T010 [P] Create update driver profile DTO in `apps/nest/auth-service/src/driver-onboarding/dto/update-driver-profile.dto.ts`

---

### T011: Create Register Vehicle DTO

**File**: `apps/nest/auth-service/src/driver-onboarding/dto/register-vehicle.dto.ts`

**Action**: Create the vehicle registration DTO:

```typescript
import {
  IsString,
  IsInt,
  Min,
  Max,
  MaxLength,
  IsOptional,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

const currentYear = new Date().getFullYear();
const minYear = currentYear - 20;
const maxYear = currentYear + 1;

export class RegisterVehicleDto {
  @ApiProperty({ example: "Toyota", maxLength: 50 })
  @IsString()
  @MaxLength(50)
  make: string;

  @ApiProperty({ example: "Camry", maxLength: 50 })
  @IsString()
  @MaxLength(50)
  model: string;

  @ApiProperty({ example: 2022, minimum: 2006, maximum: 2027 })
  @IsInt()
  @Min(minYear, { message: `Year must be ${minYear} or newer` })
  @Max(maxYear, { message: `Year cannot be later than ${maxYear}` })
  year: number;

  @ApiProperty({ example: "White", maxLength: 30 })
  @IsString()
  @MaxLength(30)
  color: string;

  @ApiProperty({ example: "ABC-1234", maxLength: 20 })
  @IsString()
  @MaxLength(20)
  plateNumber: string;

  @ApiPropertyOptional({ description: "OCR-extracted license text" })
  @IsOptional()
  @IsString()
  carLicenseText?: string;
}
```

- [ ] T011 [P] Create register vehicle DTO in `apps/nest/auth-service/src/driver-onboarding/dto/register-vehicle.dto.ts`

---

### T012: Create Onboarding Status Response DTO

**File**: `apps/nest/auth-service/src/driver-onboarding/dto/onboarding-status.dto.ts`

**Action**: Create the response DTO:

```typescript
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PresignedUrlDto {
  @ApiProperty({ description: "Presigned URL valid for 1 hour" })
  url: string;

  @ApiProperty({ description: "URL expiration timestamp" })
  expiresAt: Date;
}

export class DocumentStatusDto {
  @ApiProperty({ description: "Whether all required images uploaded" })
  completed: boolean;

  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  status: string;

  @ApiProperty({
    type: [PresignedUrlDto],
    description: "Presigned URLs for images",
  })
  images: PresignedUrlDto[];

  @ApiPropertyOptional({
    description: "Reason for rejection if status is REJECTED",
  })
  rejectionReason?: string | null;

  @ApiProperty({ description: "Number of upload attempts" })
  uploadAttempts: number;
}

export class VehicleStatusDto {
  @ApiProperty({ description: "Whether vehicle is registered" })
  completed: boolean;

  @ApiProperty({ enum: ["PENDING", "APPROVED", "REJECTED"] })
  status: string;

  @ApiProperty({ description: "Presigned URL for car image" })
  carImage: PresignedUrlDto;

  @ApiProperty({ description: "Presigned URL for car license image" })
  carLicenseImage: PresignedUrlDto;

  @ApiPropertyOptional({ description: "Reason for rejection" })
  rejectionReason?: string | null;

  @ApiProperty({ description: "Number of upload attempts" })
  uploadAttempts: number;
}

export class DocumentsStatusDto {
  @ApiProperty()
  identity: DocumentStatusDto;

  @ApiProperty()
  drivingLicense: DocumentStatusDto;

  @ApiProperty()
  vehicle: VehicleStatusDto;
}

export class OnboardingStatusDataDto {
  @ApiProperty({
    enum: ["PENDING_DOCUMENTS", "UNDER_REVIEW", "APPROVED", "REJECTED"],
  })
  onboardingStatus: string;

  @ApiPropertyOptional({ description: "Set when status is APPROVED" })
  approvedAt?: Date | null;

  @ApiProperty()
  documents: DocumentsStatusDto;
}

export class OnboardingStatusResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  data: OnboardingStatusDataDto;
}
```

- [ ] T012 [P] Create onboarding status DTOs in `apps/nest/auth-service/src/driver-onboarding/dto/onboarding-status.dto.ts`

---

### T013: Create Driver Onboarding Service

**File**: `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

**Action**: Create the main service with all business logic:

```typescript
import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
  TooManyRequestsException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../shared/storage/storage.service";
import { UpdateDriverProfileDto } from "./dto/update-driver-profile.dto";
import { RegisterVehicleDto } from "./dto/register-vehicle.dto";
import { v4 as uuidv4 } from "uuid";

const MAX_UPLOAD_ATTEMPTS = 3;
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class DriverOnboardingService {
  private readonly logger = new Logger(DriverOnboardingService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async updateProfile(userId: string, dto: UpdateDriverProfileDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new ForbiddenException("Driver not found");
    }

    // Critical fields (phone, email) are restricted - handled separately
    // Only non-critical fields can be updated here

    const updatedDriver = await this.prisma.driver.update({
      where: { userId },
      data: {
        // Store additional profile fields in a JSON or separate table
        // For now, we'll just update the driver record
        updatedAt: new Date(),
      },
      include: { user: true },
    });

    return {
      success: true,
      data: {
        id: updatedDriver.id,
        userId: updatedDriver.userId,
        licenseNumber: updatedDriver.licenseNumber,
        onboardingStatus: updatedDriver.onboardingStatus,
        rating: updatedDriver.rating,
        totalTrips: updatedDriver.totalTrips,
        createdAt: updatedDriver.createdAt,
        updatedAt: updatedDriver.updatedAt,
      },
    };
  }

  async uploadIdentityDocuments(userId: string, files: Express.Multer.File[]) {
    if (files.length !== 3) {
      throw new BadRequestException("Exactly 3 identity images are required");
    }

    this.validateFiles(files);

    const driver = await this.getDriverByUserId(userId);
    await this.checkUploadAttempts(driver.id, "identity");

    const prefix = `drivers/${userId}/identity`;
    const uploadResults = await this.uploadFiles(files, prefix);

    const objectKeys = uploadResults.map((r) => r.objectName);

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.driverDocument.upsert({
        where: { driverId: driver.id },
        create: {
          driverId: driver.id,
          identityImages: objectKeys,
          identityStatus: "PENDING",
          identityUploadAttempts: 1,
        },
        update: {
          identityImages: objectKeys,
          identityStatus: "PENDING",
          identityRejectionReason: null,
          identityUploadAttempts: { increment: 1 },
        },
      });

      await this.checkAndTransitionToUnderReview(driver.id, tx);

      return doc;
    });

    const presignedUrls =
      await this.storage.getPresignedUrlsForObjectKeys(objectKeys);

    return {
      success: true,
      data: {
        identityImages: presignedUrls,
        status: document.identityStatus,
        uploadAttempts: document.identityUploadAttempts,
        onboardingStatus: await this.getOnboardingStatusValue(driver.id),
      },
    };
  }

  async uploadDrivingLicenseDocuments(
    userId: string,
    files: Express.Multer.File[],
  ) {
    if (files.length !== 2) {
      throw new BadRequestException(
        "Exactly 2 driving license images are required",
      );
    }

    this.validateFiles(files);

    const driver = await this.getDriverByUserId(userId);
    await this.checkUploadAttempts(driver.id, "drivingLicense");

    const prefix = `drivers/${userId}/driving-license`;
    const uploadResults = await this.uploadFiles(files, prefix);

    const objectKeys = uploadResults.map((r) => r.objectName);

    const document = await this.prisma.$transaction(async (tx) => {
      const doc = await tx.driverDocument.upsert({
        where: { driverId: driver.id },
        create: {
          driverId: driver.id,
          drivingLicenseImages: objectKeys,
          drivingLicenseStatus: "PENDING",
          drivingLicenseUploadAttempts: 1,
        },
        update: {
          drivingLicenseImages: objectKeys,
          drivingLicenseStatus: "PENDING",
          drivingLicenseRejectionReason: null,
          drivingLicenseUploadAttempts: { increment: 1 },
        },
      });

      await this.checkAndTransitionToUnderReview(driver.id, tx);

      return doc;
    });

    const presignedUrls =
      await this.storage.getPresignedUrlsForObjectKeys(objectKeys);

    return {
      success: true,
      data: {
        drivingLicenseImages: presignedUrls,
        status: document.drivingLicenseStatus,
        uploadAttempts: document.drivingLicenseUploadAttempts,
        onboardingStatus: await this.getOnboardingStatusValue(driver.id),
      },
    };
  }

  async registerVehicle(
    userId: string,
    dto: RegisterVehicleDto,
    carImage: Express.Multer.File,
    carLicenseImage: Express.Multer.File,
  ) {
    this.validateFiles([carImage, carLicenseImage]);

    const driver = await this.getDriverByUserId(userId);

    const prefix = `drivers/${userId}/vehicle`;
    const carImageResult = await this.uploadSingleFile(
      carImage,
      `${prefix}/car-${uuidv4()}`,
    );
    const licenseImageResult = await this.uploadSingleFile(
      carLicenseImage,
      `${prefix}/license-${uuidv4()}`,
    );

    const vehicle = await this.prisma.$transaction(async (tx) => {
      // Check if driver already has a vehicle
      const existingDriver = await tx.driver.findUnique({
        where: { id: driver.id },
        include: { vehicle: true },
      });

      let vehicleRecord;

      if (existingDriver?.vehicleId && existingDriver.vehicle) {
        // Update existing vehicle
        vehicleRecord = await tx.vehicle.update({
          where: { id: existingDriver.vehicleId },
          data: {
            make: dto.make,
            model: dto.model,
            year: dto.year,
            color: dto.color,
            plateNumber: dto.plateNumber,
            carImage: carImageResult.objectName,
            carLicenseImage: licenseImageResult.objectName,
            carLicenseText: dto.carLicenseText,
            status: "PENDING",
            rejectionReason: null,
            uploadAttempts: { increment: 1 },
          },
        });

        this.logger.log(`Vehicle updated for driver ${driver.id}`);
      } else {
        // Check upload attempts for new vehicle
        const existingVehicle = await tx.vehicle.findUnique({
          where: { plateNumber: dto.plateNumber },
        });

        if (existingVehicle) {
          throw new ConflictException(
            "Vehicle with this plate number already exists",
          );
        }

        // Create new vehicle
        vehicleRecord = await tx.vehicle.create({
          data: {
            make: dto.make,
            model: dto.model,
            year: dto.year,
            color: dto.color,
            plateNumber: dto.plateNumber,
            carImage: carImageResult.objectName,
            carLicenseImage: licenseImageResult.objectName,
            carLicenseText: dto.carLicenseText,
            status: "PENDING",
            uploadAttempts: 1,
          },
        });

        // Link vehicle to driver
        await tx.driver.update({
          where: { id: driver.id },
          data: { vehicleId: vehicleRecord.id },
        });
      }

      await this.checkAndTransitionToUnderReview(driver.id, tx);

      return vehicleRecord;
    });

    const carImagePresigned = await this.storage.getPresignedGetUrl(
      vehicle.carImage,
    );
    const licenseImagePresigned = await this.storage.getPresignedGetUrl(
      vehicle.carLicenseImage,
    );

    return {
      success: true,
      data: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        plateNumber: vehicle.plateNumber,
        carImage: carImagePresigned,
        carLicenseImage: licenseImagePresigned,
        status: vehicle.status,
        uploadAttempts: vehicle.uploadAttempts,
        onboardingStatus: await this.getOnboardingStatusValue(driver.id),
      },
    };
  }

  async getOnboardingStatus(userId: string) {
    const driver = await this.getDriverByUserId(userId);

    const document = await this.prisma.driverDocument.findUnique({
      where: { driverId: driver.id },
    });

    const driverWithVehicle = await this.prisma.driver.findUnique({
      where: { id: driver.id },
      include: { vehicle: true },
    });

    // Build identity status
    const identityCompleted = (document?.identityImages?.length ?? 0) === 3;
    const identityImages = document?.identityImages ?? [];
    const identityPresignedUrls =
      await this.storage.getPresignedUrlsForObjectKeys(identityImages);

    // Build driving license status
    const licenseCompleted =
      (document?.drivingLicenseImages?.length ?? 0) === 2;
    const licenseImages = document?.drivingLicenseImages ?? [];
    const licensePresignedUrls =
      await this.storage.getPresignedUrlsForObjectKeys(licenseImages);

    // Build vehicle status
    const vehicleCompleted =
      !!driverWithVehicle?.vehicleId && !!driverWithVehicle.vehicle;
    let vehicleCarImagePresigned = null;
    let vehicleLicensePresigned = null;

    if (driverWithVehicle?.vehicle) {
      vehicleCarImagePresigned = await this.storage.getPresignedGetUrl(
        driverWithVehicle.vehicle.carImage,
      );
      vehicleLicensePresigned = await this.storage.getPresignedGetUrl(
        driverWithVehicle.vehicle.carLicenseImage,
      );
    }

    return {
      success: true,
      data: {
        onboardingStatus: driver.onboardingStatus,
        approvedAt: null, // Set by admin approval (separate feature)
        documents: {
          identity: {
            completed: identityCompleted,
            status: document?.identityStatus ?? "PENDING",
            images: identityPresignedUrls,
            rejectionReason: document?.identityRejectionReason,
            uploadAttempts: document?.identityUploadAttempts ?? 0,
          },
          drivingLicense: {
            completed: licenseCompleted,
            status: document?.drivingLicenseStatus ?? "PENDING",
            images: licensePresignedUrls,
            rejectionReason: document?.drivingLicenseRejectionReason,
            uploadAttempts: document?.drivingLicenseUploadAttempts ?? 0,
          },
          vehicle: {
            completed: vehicleCompleted,
            status: driverWithVehicle?.vehicle?.status ?? "PENDING",
            carImage: vehicleCarImagePresigned ?? {
              url: "",
              expiresAt: new Date(),
            },
            carLicenseImage: vehicleLicensePresigned ?? {
              url: "",
              expiresAt: new Date(),
            },
            rejectionReason: driverWithVehicle?.vehicle?.rejectionReason,
            uploadAttempts: driverWithVehicle?.vehicle?.uploadAttempts ?? 0,
          },
        },
      },
    };
  }

  private async getDriverByUserId(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new ForbiddenException("Driver not found");
    }

    return driver;
  }

  private validateFiles(files: Express.Multer.File[]) {
    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new BadRequestException(
          `Invalid file type: ${file.mimetype}. Allowed: jpg, png, webp`,
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          `File too large: ${file.originalname}. Maximum size is 10MB`,
        );
      }
    }
  }

  private async checkUploadAttempts(
    driverId: string,
    docType: "identity" | "drivingLicense",
  ) {
    const document = await this.prisma.driverDocument.findUnique({
      where: { driverId },
    });

    const attempts =
      docType === "identity"
        ? (document?.identityUploadAttempts ?? 0)
        : (document?.drivingLicenseUploadAttempts ?? 0);

    if (attempts >= MAX_UPLOAD_ATTEMPTS) {
      throw new TooManyRequestsException(
        `Maximum upload attempts (${MAX_UPLOAD_ATTEMPTS}) exceeded for ${docType}. Please contact support.`,
      );
    }
  }

  private async uploadFiles(files: Express.Multer.File[], prefix: string) {
    const results = [];

    for (const file of files) {
      const objectName = `${prefix}/${uuidv4()}.${this.getExtension(file.mimetype)}`;
      const result = await this.storage.upload(
        objectName,
        file.buffer,
        file.size,
        {
          contentType: file.mimetype,
        },
      );
      results.push(result);
    }

    return results;
  }

  private async uploadSingleFile(
    file: Express.Multer.File,
    objectName: string,
  ) {
    return this.storage.upload(objectName, file.buffer, file.size, {
      contentType: file.mimetype,
    });
  }

  private getExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return extensions[mimetype] ?? "jpg";
  }

  private async checkAndTransitionToUnderReview(driverId: string, tx: any) {
    const document = await tx.driverDocument.findUnique({
      where: { driverId },
    });

    const driver = await tx.driver.findUnique({
      where: { id: driverId },
      include: { vehicle: true },
    });

    const hasIdentity = (document?.identityImages?.length ?? 0) === 3;
    const hasLicense = (document?.drivingLicenseImages?.length ?? 0) === 2;
    const hasVehicle = !!driver?.vehicleId && !!driver.vehicle;

    if (hasIdentity && hasLicense && hasVehicle) {
      await tx.driver.update({
        where: { id: driverId },
        data: { onboardingStatus: "UNDER_REVIEW" },
      });

      this.logger.log(`Driver ${driverId} transitioned to UNDER_REVIEW`);
    }
  }

  private async getOnboardingStatusValue(driverId: string): Promise<string> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      select: { onboardingStatus: true },
    });
    return driver?.onboardingStatus ?? "PENDING_DOCUMENTS";
  }
}
```

- [ ] T013 Create driver onboarding service in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.service.ts`

---

### T014: Create Driver Onboarding Controller

**File**: `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

**Action**: Create the controller with all endpoints:

```typescript
import {
  Controller,
  Patch,
  Post,
  Get,
  UseGuards,
  Request,
  Body,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from "@nestjs/common";
import {
  FileFieldsInterceptor,
  FilesInterceptor,
} from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
} from "@nestjs/swagger";
import { DriverGuard } from "../auth/guards/driver.guard";
import { DriverOnboardingService } from "./driver-onboarding.service";
import { UpdateDriverProfileDto } from "./dto/update-driver-profile.dto";
import { RegisterVehicleDto } from "./dto/register-vehicle.dto";

@ApiTags("Driver Onboarding")
@Controller("auth/driver")
@UseGuards(DriverGuard)
@ApiBearerAuth()
export class DriverOnboardingController {
  constructor(private readonly service: DriverOnboardingService) {}

  @Patch("profile")
  @ApiOperation({ summary: "Update driver profile fields" })
  @ApiResponse({ status: 200, description: "Profile updated successfully" })
  @ApiResponse({ status: 400, description: "Validation error" })
  @ApiResponse({ status: 403, description: "Driver access required" })
  async updateProfile(
    @Request() req: any,
    @Body() dto: UpdateDriverProfileDto,
  ) {
    return this.service.updateProfile(req.user.sub, dto);
  }

  @Post("documents/identity")
  @ApiOperation({
    summary: "Upload identity verification documents (3 images)",
  })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Identity documents uploaded" })
  @ApiResponse({ status: 400, description: "Invalid file or wrong count" })
  @ApiResponse({ status: 409, description: "Documents already exist" })
  @ApiResponse({ status: 413, description: "File too large (max 10MB)" })
  @ApiResponse({ status: 429, description: "Retry limit exceeded" })
  @UseInterceptors(FilesInterceptor("files", 3))
  async uploadIdentityDocuments(
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files uploaded");
    }
    return this.service.uploadIdentityDocuments(req.user.sub, files);
  }

  @Post("documents/driving-license")
  @ApiOperation({ summary: "Upload driving license documents (2 images)" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Driving license uploaded" })
  @ApiResponse({ status: 400, description: "Invalid file or wrong count" })
  @ApiResponse({ status: 413, description: "File too large (max 10MB)" })
  @ApiResponse({ status: 429, description: "Retry limit exceeded" })
  @UseInterceptors(FilesInterceptor("files", 2))
  async uploadDrivingLicenseDocuments(
    @Request() req: any,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("No files uploaded");
    }
    return this.service.uploadDrivingLicenseDocuments(req.user.sub, files);
  }

  @Post("vehicle")
  @ApiOperation({ summary: "Register or update vehicle" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Vehicle registered" })
  @ApiResponse({ status: 400, description: "Invalid data or files" })
  @ApiResponse({ status: 413, description: "File too large (max 10MB)" })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: "carImage", maxCount: 1 },
      { name: "carLicenseImage", maxCount: 1 },
    ]),
  )
  async registerVehicle(
    @Request() req: any,
    @Body() dto: RegisterVehicleDto,
    @UploadedFiles()
    files: {
      carImage?: Express.Multer.File[];
      carLicenseImage?: Express.Multer.File[];
    },
  ) {
    if (!files.carImage?.[0] || !files.carLicenseImage?.[0]) {
      throw new BadRequestException(
        "Both carImage and carLicenseImage are required",
      );
    }

    return this.service.registerVehicle(
      req.user.sub,
      dto,
      files.carImage[0],
      files.carLicenseImage[0],
    );
  }

  @Get("onboarding-status")
  @ApiOperation({ summary: "Get driver onboarding status" })
  @ApiResponse({ status: 200, description: "Onboarding status retrieved" })
  async getOnboardingStatus(@Request() req: any) {
    return this.service.getOnboardingStatus(req.user.sub);
  }
}
```

- [ ] T014 Create driver onboarding controller in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.controller.ts`

---

### T015: Create Driver Onboarding Module

**File**: `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.module.ts`

**Action**: Create the NestJS module:

```typescript
import { Module } from "@nestjs/common";
import { DriverOnboardingController } from "./driver-onboarding.controller";
import { DriverOnboardingService } from "./driver-onboarding.service";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../shared/storage/storage.module";
import { DriverGuard } from "../auth/guards/driver.guard";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [DriverOnboardingController],
  providers: [DriverOnboardingService, DriverGuard],
  exports: [DriverOnboardingService],
})
export class DriverOnboardingModule {}
```

- [ ] T015 Create driver onboarding module in `apps/nest/auth-service/src/driver-onboarding/driver-onboarding.module.ts`

---

### T016: Create Upload Profile Image DTO

**File**: `apps/nest/auth-service/src/rider-profile/dto/upload-profile-image.dto.ts`

**Action**: Create directory `apps/nest/auth-service/src/rider-profile/dto/` if needed:

```typescript
// No body DTO needed - file upload only
// This file exists for consistency and future extensions
```

- [ ] T016 [P] Create upload profile image DTO placeholder in `apps/nest/auth-service/src/rider-profile/dto/upload-profile-image.dto.ts`

---

### T017: Create Rider Profile Service

**File**: `apps/nest/auth-service/src/rider-profile/rider-profile.service.ts`

**Action**: Create the rider profile service:

```typescript
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../shared/storage/storage.service";
import { v4 as uuidv4 } from "uuid";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

@Injectable()
export class RiderProfileService {
  private readonly logger = new Logger(RiderProfileService.name);

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async uploadProfileImage(userId: string, file: Express.Multer.File) {
    // Validate file
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Invalid file type: ${file.mimetype}. Allowed: jpg, png, webp`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException("File size exceeds 10MB limit");
    }

    // Get user and check if rider
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== "RIDER") {
      throw new ForbiddenException("Rider not found");
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      try {
        // Extract object key from full URL
        const urlParts = user.profileImage.split("/");
        const bucketIndex = urlParts.findIndex((part) => part === "ain-rider");
        if (bucketIndex !== -1) {
          const objectKey = urlParts.slice(bucketIndex + 1).join("/");
          await this.storage.delete(objectKey);
          this.logger.log(`Deleted old profile image for user ${userId}`);
        }
      } catch (error) {
        // Log but don't fail if old image deletion fails
        this.logger.warn(`Failed to delete old profile image: ${error}`);
      }
    }

    // Upload new image
    const objectName = `riders/${userId}/profile/${uuidv4()}.${this.getExtension(file.mimetype)}`;
    const uploadResult = await this.storage.upload(
      objectName,
      file.buffer,
      file.size,
      {
        contentType: file.mimetype,
      },
    );

    // Update user profile
    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImage: uploadResult.url },
    });

    // Generate presigned URL for response
    const presignedUrl = await this.storage.getPresignedGetUrl(objectName);

    return {
      success: true,
      data: {
        profileImage: presignedUrl,
      },
    };
  }

  private getExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return extensions[mimetype] ?? "jpg";
  }
}
```

- [ ] T017 Create rider profile service in `apps/nest/auth-service/src/rider-profile/rider-profile.service.ts`

---

### T018: Create Rider Profile Controller

**File**: `apps/nest/auth-service/src/rider-profile/rider-profile.controller.ts`

**Action**: Create the controller:

```typescript
import {
  Controller,
  Patch,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiResponse,
} from "@nestjs/swagger";
import { RiderGuard } from "../auth/guards/rider.guard";
import { RiderProfileService } from "./rider-profile.service";

@ApiTags("Rider Profile")
@Controller("auth/rider")
@UseGuards(RiderGuard)
@ApiBearerAuth()
export class RiderProfileController {
  constructor(private readonly service: RiderProfileService) {}

  @Patch("profile/image")
  @ApiOperation({ summary: "Upload rider profile image" })
  @ApiConsumes("multipart/form-data")
  @ApiResponse({ status: 200, description: "Profile image uploaded" })
  @ApiResponse({ status: 400, description: "Invalid file" })
  @ApiResponse({ status: 403, description: "Rider access required" })
  @ApiResponse({ status: 413, description: "File too large (max 10MB)" })
  @UseInterceptors(FileInterceptor("image"))
  async uploadProfileImage(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException("No image file uploaded");
    }
    return this.service.uploadProfileImage(req.user.sub, file);
  }
}
```

- [ ] T018 Create rider profile controller in `apps/nest/auth-service/src/rider-profile/rider-profile.controller.ts`

---

### T019: Create Rider Profile Module

**File**: `apps/nest/auth-service/src/rider-profile/rider-profile.module.ts`

**Action**: Create the NestJS module:

```typescript
import { Module } from "@nestjs/common";
import { RiderProfileController } from "./rider-profile.controller";
import { RiderProfileService } from "./rider-profile.service";
import { PrismaModule } from "../prisma/prisma.module";
import { StorageModule } from "../shared/storage/storage.module";
import { RiderGuard } from "../auth/guards/rider.guard";

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [RiderProfileController],
  providers: [RiderProfileService, RiderGuard],
  exports: [RiderProfileService],
})
export class RiderProfileModule {}
```

- [ ] T019 Create rider profile module in `apps/nest/auth-service/src/rider-profile/rider-profile.module.ts`

---

### T020: Register Modules in App Module

**File**: `apps/nest/auth-service/src/app.module.ts`

**Action**: Add the new modules to the imports array. Update the file to include:

1. Import the new modules at the top:

```typescript
import { DriverOnboardingModule } from "./driver-onboarding/driver-onboarding.module";
import { RiderProfileModule } from "./rider-profile/rider-profile.module";
import { StorageModule } from "./shared/storage/storage.module";
```

2. Add them to the `imports` array in the `@Module` decorator:

```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TerminusModule,
    PrismaModule,
    AuthModule,
    StorageModule,
    DriverOnboardingModule,
    RiderProfileModule,
  ],
  controllers: [HealthController],
})
```

- [ ] T020 Register StorageModule, DriverOnboardingModule, and RiderProfileModule in `apps/nest/auth-service/src/app.module.ts`

---

**Checkpoint**: Foundation ready - all shared infrastructure is in place. User story implementation can now proceed.

---

## Phase 3: User Story 1 - Driver Profile Completion (Priority: P1)

**Goal**: Allow drivers to update non-critical profile fields like address, emergency contact

**Independent Test**: Call PATCH /auth/driver/profile with valid JWT token for a DRIVER user, verify 200 response with updated data

**Status**: ALREADY IMPLEMENTED in Phase 2 (T010, T013, T014)

**Checkpoint**: User Story 1 is complete. The endpoint PATCH /auth/driver/profile is functional.

---

## Phase 4: User Story 2 - Driver Identity Document Upload (Priority: P1)

**Goal**: Allow drivers to upload 3 identity verification images

**Independent Test**: Call POST /auth/driver/documents/identity with 3 image files and valid DRIVER JWT, verify images stored in MinIO and DB updated

**Status**: ALREADY IMPLEMENTED in Phase 2 (T013, T014)

**Checkpoint**: User Story 2 is complete. The endpoint POST /auth/driver/documents/identity is functional.

---

## Phase 5: User Story 3 - Driver Driving License Upload (Priority: P1)

**Goal**: Allow drivers to upload 2 driving license images

**Independent Test**: Call POST /auth/driver/documents/driving-license with 2 image files and valid DRIVER JWT, verify images stored in MinIO and DB updated

**Status**: ALREADY IMPLEMENTED in Phase 2 (T013, T014)

**Checkpoint**: User Story 3 is complete. The endpoint POST /auth/driver/documents/driving-license is functional.

---

## Phase 6: User Story 4 - Driver Vehicle Registration (Priority: P2)

**Goal**: Allow drivers to register vehicle with details and images

**Independent Test**: Call POST /auth/driver/vehicle with vehicle data and 2 image files, verify vehicle record created and linked to driver

**Status**: ALREADY IMPLEMENTED in Phase 2 (T011, T013, T014)

**Checkpoint**: User Story 4 is complete. The endpoint POST /auth/driver/vehicle is functional.

---

## Phase 7: User Story 5 - Driver Onboarding Status Check (Priority: P2)

**Goal**: Allow drivers and mobile app to check current onboarding status

**Independent Test**: Call GET /auth/driver/onboarding-status with valid DRIVER JWT, verify response shows correct status for each document type

**Status**: ALREADY IMPLEMENTED in Phase 2 (T012, T013, T014)

**Checkpoint**: User Story 5 is complete. The endpoint GET /auth/driver/onboarding-status is functional.

---

## Phase 8: User Story 6 - Rider Profile Image Upload (Priority: P3)

**Goal**: Allow riders to upload profile image

**Independent Test**: Call PATCH /auth/rider/profile/image with image file and valid RIDER JWT, verify image stored and User.profileImage updated

**Status**: ALREADY IMPLEMENTED in Phase 2 (T016, T017, T018, T019)

**Checkpoint**: User Story 6 is complete. The endpoint PATCH /auth/rider/profile/image is functional.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and documentation

### T021: Verify All Endpoints Work

**Action**: Start the auth-service and test each endpoint:

```bash
cd apps/nest/auth-service
npm run start:dev
```

Test endpoints in order:

1. PATCH /auth/driver/profile
2. POST /auth/driver/documents/identity
3. POST /auth/driver/documents/driving-license
4. POST /auth/driver/vehicle
5. GET /auth/driver/onboarding-status
6. PATCH /auth/rider/profile/image

- [ ] T021 Verify all endpoints work by testing with curl or Postman

---

### T022: Run Lint and Type Check

**Action**: Run the following commands to ensure code quality:

```bash
cd apps/nest/auth-service
npm run lint
npx tsc --noEmit
```

Fix any issues found.

- [ ] T022 Run lint and TypeScript type checking, fix any issues

---

### T023: Update AGENTS.md

**Action**: Verify the AGENTS.md file was updated with the new technologies. If not, run:

```bash
pwsh -ExecutionPolicy Bypass -File ".specify/scripts/powershell/update-agent-context.ps1" -AgentType opencode
```

- [ ] T023 Verify AGENTS.md has been updated with new technologies

---

## Dependencies & Execution Order

### Phase Dependencies

1. **Phase 1 (Setup)**: Must complete first - Prisma schema changes
2. **Phase 2 (Foundational)**: Depends on Phase 1 - Creates all services, controllers, modules
3. **Phases 3-8 (User Stories)**: All functionality implemented in Phase 2
4. **Phase 9 (Polish)**: Final validation

### Task Dependencies Within Phase 2

```
T010, T011, T012 (DTOs) ──┐
T003, T004, T005 (Storage) ──┼──> T013 (Service) ──> T014 (Controller) ──> T015 (Module) ──> T020 (App Module)
T006, T007 (Guards) ────────┤
T008, T009 (Events) ────────┘

T016 (Rider DTO) ──> T017 (Rider Service) ──> T018 (Rider Controller) ──> T019 (Rider Module) ──> T020 (App Module)
```

### Parallel Opportunities

Tasks marked with [P] can run in parallel:

- T003, T004, T005, T006, T007, T008 can all run in parallel
- T010, T011, T012 can run in parallel
- T016 can run in parallel with other DTO tasks

---

## Parallel Example: Phase 2 Setup

```bash
# These can all be done simultaneously by different agents/developers:
Task T003: Create storage config
Task T004: Create storage service
Task T005: Create storage module
Task T006: Create driver guard
Task T007: Create rider guard
Task T008: Add DRIVER_APPROVED event
Task T010: Create update driver profile DTO
Task T011: Create register vehicle DTO
Task T012: Create onboarding status DTOs

# Then sequentially:
Task T009: Create driver event publisher (needs T008)
Task T013: Create driver onboarding service (needs T003-T012)
Task T014: Create driver onboarding controller (needs T013)
Task T015: Create driver onboarding module (needs T013, T014)
Task T017-T019: Create rider profile module
Task T020: Register all modules in app
```

---

## Implementation Strategy

### MVP First

1. Complete Phase 1 (T001-T002): Prisma schema
2. Complete Phase 2 (T003-T020): All services and controllers
3. Complete Phase 9 (T021-T023): Validation
4. **DEPLOY**: All 6 user stories are complete

### Key Files Summary

| File                                                | Purpose                                          |
| --------------------------------------------------- | ------------------------------------------------ |
| `prisma/schema.prisma`                              | Database models (DriverDocument, Vehicle, enums) |
| `shared/storage/storage.service.ts`                 | MinIO file upload/presigned URLs                 |
| `auth/guards/driver.guard.ts`                       | Role check for DRIVER                            |
| `auth/guards/rider.guard.ts`                        | Role check for RIDER                             |
| `driver-onboarding/driver-onboarding.service.ts`    | All driver onboarding business logic             |
| `driver-onboarding/driver-onboarding.controller.ts` | Driver API endpoints                             |
| `rider-profile/rider-profile.service.ts`            | Rider profile image logic                        |
| `rider-profile/rider-profile.controller.ts`         | Rider API endpoint                               |
| `events/driver-event.publisher.ts`                  | NATS event publisher                             |

---

## Notes

- All tasks have exact file paths
- Code is provided for complex implementations
- Follow existing patterns from admin-service for MinIO
- Use Prisma transactions for atomic operations
- Return unified response format: `{success, data}` or `{success: false, error: {code, message}}`
- Presigned URLs expire in 1 hour (3600 seconds)
- Maximum 3 upload attempts per document type
- Maximum 10MB per file
- Allowed image types: jpg, png, webp
