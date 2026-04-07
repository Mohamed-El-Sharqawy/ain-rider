import {
  Injectable,
  BadRequestException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
  HttpStatus,
  HttpException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../shared/storage/storage.service";
import { UpdateDriverProfileDto } from "./dto/update-driver-profile.dto";
import { OnboardingStatus, DocumentStatus } from "../generated/prisma";
import type { PresignedUrlResult } from "../shared/storage/storage.service";
import type { UploadedFile } from "../shared/types";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_UPLOAD_ATTEMPTS = 3;

@Injectable()
export class DriverOnboardingService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async updateOnlineStatus(userId: string, isOnline: boolean) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    if (isOnline && driver.onboardingStatus !== OnboardingStatus.APPROVED) {
      throw new BadRequestException(
        "Only approved drivers can go online. Current status: " +
          driver.onboardingStatus,
      );
    }

    return this.prisma.driver.update({
      where: { userId },
      data: { isOnline },
      select: {
        id: true,
        userId: true,
        isOnline: true,
        onboardingStatus: true,
      },
    });
  }

  async updateDriverProfile(userId: string, dto: UpdateDriverProfileDto) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const updateData: Record<string, unknown> = {};
    if (dto.address !== undefined) updateData.address = dto.address;
    if (dto.city !== undefined) updateData.city = dto.city;
    if (dto.state !== undefined) updateData.state = dto.state;
    if (dto.country !== undefined) updateData.country = dto.country;
    if (dto.dateOfBirth !== undefined)
      updateData.dateOfBirth = new Date(dto.dateOfBirth);
    if (dto.emergencyContactName !== undefined)
      updateData.emergencyContactName = dto.emergencyContactName;
    if (dto.emergencyContactPhone !== undefined)
      updateData.emergencyContactPhone = dto.emergencyContactPhone;

    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }

    const updatedDriver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { user: true },
    });

    const user = updatedDriver!.user;
    return {
      id: updatedDriver!.id,
      userId: updatedDriver!.userId,
      onboardingStatus: updatedDriver!.onboardingStatus,
      user: {
        id: user.id,
        email: user.email,
        phoneNumber: user.phoneNumber,
        firstName: user.firstName,
        lastName: user.lastName,
        address: user.address,
        city: user.city,
        state: user.state,
        country: user.country,
        dateOfBirth: user.dateOfBirth,
        emergencyContactName: user.emergencyContactName,
        emergencyContactPhone: user.emergencyContactPhone,
      },
    };
  }

  private validateFiles(files: UploadedFile[], expectedCount: number): void {
    if (!files || files.length !== expectedCount) {
      throw new BadRequestException(
        `Exactly ${expectedCount} files are required`,
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        throw new UnsupportedMediaTypeException(
          `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        throw new PayloadTooLargeException(
          `File too large: ${file.originalname}. Max size: 10MB`,
        );
      }
    }
  }

  private getFileExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return extensions[mimetype] || "jpg";
  }

  private async checkAndTransitionToUnderReview(
    driverId: string,
  ): Promise<OnboardingStatus> {
    const driver = await this.prisma.driver.findUnique({
      where: { id: driverId },
      include: { document: true, vehicle: true },
    });

    if (!driver) return OnboardingStatus.PENDING_DOCUMENTS;

    const hasIdentityDocs =
      driver.document && driver.document.identityImages.length > 0;
    const hasLicenseDocs =
      driver.document && driver.document.drivingLicenseImages.length > 0;
    const hasVehicle = driver.vehicleId !== null;

    if (hasIdentityDocs && hasLicenseDocs && hasVehicle) {
      await this.prisma.$transaction([
        this.prisma.driver.update({
          where: { id: driverId },
          data: { onboardingStatus: OnboardingStatus.UNDER_REVIEW },
        }),
        this.prisma.user.update({
          where: { id: driver.userId },
          data: { status: "UNDER_REVIEW" },
        }),
      ]);
      return OnboardingStatus.UNDER_REVIEW;
    }

    return driver.onboardingStatus;
  }

  async uploadIdentityDocuments(
    userId: string,
    files: UploadedFile[],
  ): Promise<{
    identityImages: PresignedUrlResult[];
    status: DocumentStatus;
    uploadAttempts: number;
    onboardingStatus: OnboardingStatus;
  }> {
    this.validateFiles(files, 3);

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const existingDoc = driver.document;
    if (
      existingDoc &&
      existingDoc.identityUploadAttempts >= MAX_UPLOAD_ATTEMPTS
    ) {
      throw new HttpException(
        "Maximum upload attempts reached for identity documents. Please contact support.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const uploadedPaths: string[] = [];
    const presignedUrls: PresignedUrlResult[] = [];

    for (const file of files) {
      const ext = this.getFileExtension(file.mimetype);
      const objectName = `drivers/${userId}/identity/${crypto.randomUUID()}.${ext}`;

      await this.storage.upload(objectName, file.buffer, file.size, {
        contentType: file.mimetype,
      });

      uploadedPaths.push(objectName);

      const presigned = await this.storage.getPresignedGetUrl(objectName, 3600);
      presignedUrls.push(presigned);
    }

    const updatedDoc = await this.prisma.driverDocument.upsert({
      where: { driverId: driver.id },
      create: {
        driverId: driver.id,
        identityImages: uploadedPaths,
        identityStatus: DocumentStatus.PENDING,
        identityUploadAttempts: 1,
        drivingLicenseImages: [],
        drivingLicenseStatus: DocumentStatus.PENDING,
        drivingLicenseUploadAttempts: 0,
      },
      update: {
        identityImages: uploadedPaths,
        identityStatus: DocumentStatus.PENDING,
        identityUploadAttempts: { increment: 1 },
      },
    });

    const onboardingStatus = await this.checkAndTransitionToUnderReview(
      driver.id,
    );

    return {
      identityImages: presignedUrls,
      status: updatedDoc.identityStatus,
      uploadAttempts: updatedDoc.identityUploadAttempts,
      onboardingStatus,
    };
  }

  async uploadDrivingLicense(
    userId: string,
    files: UploadedFile[],
    licenseNumber: string,
  ): Promise<{
    drivingLicenseImages: PresignedUrlResult[];
    status: DocumentStatus;
    uploadAttempts: number;
    onboardingStatus: OnboardingStatus;
  }> {
    this.validateFiles(files, 2);

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    // Check for duplicate license number
    const existingDriverWithLicense = await this.prisma.driver.findFirst({
      where: {
        licenseNumber,
        NOT: { id: driver.id },
      },
    });
    if (existingDriverWithLicense) {
      throw new ConflictException(
        "This license number is already registered to another driver",
      );
    }

    const existingDoc = driver.document;
    if (
      existingDoc &&
      existingDoc.drivingLicenseUploadAttempts >= MAX_UPLOAD_ATTEMPTS
    ) {
      throw new HttpException(
        "Maximum upload attempts reached for driving license. Please contact support.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const uploadedPaths: string[] = [];
    const presignedUrls: PresignedUrlResult[] = [];

    for (const file of files) {
      const ext = this.getFileExtension(file.mimetype);
      const objectName = `drivers/${userId}/driving-license/${crypto.randomUUID()}.${ext}`;

      await this.storage.upload(objectName, file.buffer, file.size, {
        contentType: file.mimetype,
      });

      uploadedPaths.push(objectName);

      const presigned = await this.storage.getPresignedGetUrl(objectName, 3600);
      presignedUrls.push(presigned);
    }

    const updatedDoc = await this.prisma.driverDocument.upsert({
      where: { driverId: driver.id },
      create: {
        driverId: driver.id,
        identityImages: [],
        identityStatus: DocumentStatus.PENDING,
        identityUploadAttempts: 0,
        drivingLicenseImages: uploadedPaths,
        drivingLicenseStatus: DocumentStatus.PENDING,
        drivingLicenseUploadAttempts: 1,
      },
      update: {
        drivingLicenseImages: uploadedPaths,
        drivingLicenseStatus: DocumentStatus.PENDING,
        drivingLicenseUploadAttempts: { increment: 1 },
      },
    });

    // Save license number to Driver record
    await this.prisma.driver.update({
      where: { id: driver.id },
      data: { licenseNumber },
    });

    const onboardingStatus = await this.checkAndTransitionToUnderReview(
      driver.id,
    );

    return {
      drivingLicenseImages: presignedUrls,
      status: updatedDoc.drivingLicenseStatus,
      uploadAttempts: updatedDoc.drivingLicenseUploadAttempts,
      onboardingStatus,
    };
  }

  async registerVehicle(
    userId: string,
    data: {
      make: string;
      model: string;
      year: number;
      color: string;
      plateNumber: string;
    },
    carImage: UploadedFile,
    carLicenseImage: UploadedFile,
  ): Promise<{
    id: string;
    make: string;
    model: string;
    year: number;
    color: string;
    plateNumber: string;
    carImage: PresignedUrlResult;
    carLicenseImage: PresignedUrlResult;
    status: DocumentStatus;
    onboardingStatus: OnboardingStatus;
  }> {
    this.validateFiles([carImage, carLicenseImage], 2);

    const currentYear = new Date().getFullYear();
    if (data.year < currentYear - 20 || data.year > currentYear + 1) {
      throw new BadRequestException(
        `Vehicle year must be between ${currentYear - 20} and ${currentYear + 1}`,
      );
    }

    const normalizedPlate = data.plateNumber.toUpperCase().replace(/\s+/g, "");
    const plateRegex = /^[A-Z0-9-]{4,12}$/;
    if (!plateRegex.test(normalizedPlate)) {
      throw new BadRequestException(
        "Invalid plate number format. Use 4-12 alphanumeric characters (e.g., ABC-1234 or ABC123)",
      );
    }
    data.plateNumber = normalizedPlate;

    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const existingVehicle = driver.vehicleId
      ? await this.prisma.vehicle.findUnique({
          where: { id: driver.vehicleId },
        })
      : null;

    if (
      existingVehicle &&
      existingVehicle.uploadAttempts >= MAX_UPLOAD_ATTEMPTS
    ) {
      throw new HttpException(
        "Maximum upload attempts reached for vehicle. Please contact support.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const carImageExt = this.getFileExtension(carImage.mimetype);
    const carImageName = `drivers/${userId}/vehicle/${crypto.randomUUID()}.${carImageExt}`;
    await this.storage.upload(carImageName, carImage.buffer, carImage.size, {
      contentType: carImage.mimetype,
    });
    const carImagePresigned =
      await this.storage.getPresignedGetUrl(carImageName, 3600);

    const licenseExt = this.getFileExtension(carLicenseImage.mimetype);
    const licenseImageName = `drivers/${userId}/vehicle/${crypto.randomUUID()}.${licenseExt}`;
    await this.storage.upload(
      licenseImageName,
      carLicenseImage.buffer,
      carLicenseImage.size,
      {
        contentType: carLicenseImage.mimetype,
      },
    );
    const licensePresigned =
      await this.storage.getPresignedGetUrl(licenseImageName, 3600);

    let vehicle: {
      id: string;
      make: string;
      model: string;
      year: number;
      color: string;
      plateNumber: string;
      carImage: string;
      carLicenseImage: string;
      status: DocumentStatus;
      uploadAttempts: number;
    };

    if (existingVehicle) {
      vehicle = await this.prisma.vehicle.update({
        where: { id: existingVehicle.id },
        data: {
          make: data.make,
          model: data.model,
          year: data.year,
          color: data.color,
          plateNumber: data.plateNumber,
          carImage: carImageName,
          carLicenseImage: licenseImageName,
          status: DocumentStatus.PENDING,
          uploadAttempts: { increment: 1 },
        },
      });
    } else {
      vehicle = await this.prisma.vehicle.create({
        data: {
          make: data.make,
          model: data.model,
          year: data.year,
          color: data.color,
          plateNumber: data.plateNumber,
          carImage: carImageName,
          carLicenseImage: licenseImageName,
          status: DocumentStatus.PENDING,
          uploadAttempts: 1,
        },
      });

      await this.prisma.driver.update({
        where: { id: driver.id },
        data: { vehicleId: vehicle.id },
      });
    }

    const onboardingStatus = await this.checkAndTransitionToUnderReview(
      driver.id,
    );

    return {
      id: vehicle.id,
      make: vehicle.make,
      model: vehicle.model,
      year: vehicle.year,
      color: vehicle.color,
      plateNumber: vehicle.plateNumber,
      carImage: carImagePresigned,
      carLicenseImage: licensePresigned,
      status: vehicle.status,
      onboardingStatus,
    };
  }

  async getOnboardingStatus(userId: string): Promise<{
    onboardingStatus: OnboardingStatus;
    documents: {
      identity: {
        status: DocumentStatus;
        uploadAttempts: number;
        rejectionReason?: string;
        images: PresignedUrlResult[];
      };
      drivingLicense: {
        status: DocumentStatus;
        uploadAttempts: number;
        rejectionReason?: string;
        images: PresignedUrlResult[];
      };
        vehicle: {
          status: DocumentStatus;
          uploadAttempts: number;
          rejectionReason?: string;
          carImage?: PresignedUrlResult;
          carLicenseImage?: PresignedUrlResult;
          details?: {
            id: string;
            make: string;
            model: string;
            year: number;
            color: string;
            plateNumber: string;
          };
        };
      };
  }> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true, vehicle: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const document = driver.document;
    const vehicle = driver.vehicle;

    const identityImages: PresignedUrlResult[] = document
      ? await this.storage.getPresignedUrlsForObjectKeys(
          document.identityImages,
          3600,
        )
      : [];

    const drivingLicenseImages: PresignedUrlResult[] = document
      ? await this.storage.getPresignedUrlsForObjectKeys(
          document.drivingLicenseImages,
          3600,
        )
      : [];

    const carImagePresigned = vehicle?.carImage
      ? await this.storage.getPresignedGetUrl(vehicle.carImage, 3600)
      : undefined;

    const carLicensePresigned = vehicle?.carLicenseImage
      ? await this.storage.getPresignedGetUrl(vehicle.carLicenseImage, 3600)
      : undefined;

    return {
      onboardingStatus: driver.onboardingStatus,
      documents: {
        identity: {
          status: document?.identityStatus ?? DocumentStatus.PENDING,
          uploadAttempts: document?.identityUploadAttempts ?? 0,
          rejectionReason: document?.identityRejectionReason ?? undefined,
          images: identityImages,
        },
        drivingLicense: {
          status: document?.drivingLicenseStatus ?? DocumentStatus.PENDING,
          uploadAttempts: document?.drivingLicenseUploadAttempts ?? 0,
          rejectionReason: document?.drivingLicenseRejectionReason ?? undefined,
          images: drivingLicenseImages,
        },
        vehicle: {
          status: vehicle?.status ?? DocumentStatus.PENDING,
          uploadAttempts: vehicle?.uploadAttempts ?? 0,
          rejectionReason: vehicle?.rejectionReason ?? undefined,
          carImage: carImagePresigned,
          carLicenseImage: carLicensePresigned,
          details: vehicle
            ? {
                id: vehicle.id,
                make: vehicle.make,
                model: vehicle.model,
                year: vehicle.year,
                color: vehicle.color,
                plateNumber: vehicle.plateNumber,
              }
            : undefined,
        },
      },
    };
  }

  async resetUploadAttempts(userId: string): Promise<void> {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true, vehicle: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const updates: Promise<any>[] = [];

    if (driver.document) {
      updates.push(
        this.prisma.driverDocument.update({
          where: { id: driver.document.id },
          data: {
            identityUploadAttempts: 0,
            drivingLicenseUploadAttempts: 0,
          },
        }),
      );
    }

    if (driver.vehicleId) {
      updates.push(
        this.prisma.vehicle.update({
          where: { id: driver.vehicleId },
          data: { uploadAttempts: 0 },
        }),
      );
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  }

  async approveDriver(userId: string) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    return this.prisma.$transaction([
      this.prisma.driver.update({
        where: { userId },
        data: { onboardingStatus: OnboardingStatus.APPROVED },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: { status: "ACTIVE" },
      }),
    ]);
  }

  async rejectDocument(
    userId: string,
    stage: "identity" | "license" | "vehicle",
    reason: string,
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true, vehicle: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const updates: any[] = [];

    if (stage === "identity" && driver.document) {
      updates.push(
        this.prisma.driverDocument.update({
          where: { id: driver.document.id },
          data: {
            identityStatus: DocumentStatus.REJECTED,
            identityRejectionReason: reason,
          },
        }),
      );
    } else if (stage === "license" && driver.document) {
      updates.push(
        this.prisma.driverDocument.update({
          where: { id: driver.document.id },
          data: {
            drivingLicenseStatus: DocumentStatus.REJECTED,
            drivingLicenseRejectionReason: reason,
          },
        }),
      );
    } else if (stage === "vehicle" && driver.vehicleId) {
      updates.push(
        this.prisma.vehicle.update({
          where: { id: driver.vehicleId },
          data: {
            status: DocumentStatus.REJECTED,
            rejectionReason: reason,
          },
        }),
      );
    }

    // Set overall status to PENDING_DOCUMENTS
    updates.push(
      this.prisma.driver.update({
        where: { userId },
        data: { onboardingStatus: OnboardingStatus.PENDING_DOCUMENTS },
      }),
    );

    updates.push(
      this.prisma.user.update({
        where: { id: userId },
        data: { status: "PENDING_DOCUMENTS" },
      }),
    );

    return this.prisma.$transaction(updates);
  }

  async approveDocument(
    userId: string,
    stage: "identity" | "license" | "vehicle",
  ) {
    const driver = await this.prisma.driver.findUnique({
      where: { userId },
      include: { document: true, vehicle: true },
    });

    if (!driver) {
      throw new NotFoundException("Driver not found");
    }

    const updates: any[] = [];

    if (stage === "identity" && driver.document) {
      updates.push(
        this.prisma.driverDocument.update({
          where: { id: driver.document.id },
          data: {
            identityStatus: DocumentStatus.APPROVED,
            identityRejectionReason: null,
          },
        }),
      );
    } else if (stage === "license" && driver.document) {
      updates.push(
        this.prisma.driverDocument.update({
          where: { id: driver.document.id },
          data: {
            drivingLicenseStatus: DocumentStatus.APPROVED,
            drivingLicenseRejectionReason: null,
          },
        }),
      );
    } else if (stage === "vehicle" && driver.vehicleId) {
      updates.push(
        this.prisma.vehicle.update({
          where: { id: driver.vehicleId },
          data: {
            status: DocumentStatus.APPROVED,
            rejectionReason: null,
          },
        }),
      );
    }

    return this.prisma.$transaction(updates);
  }
}
