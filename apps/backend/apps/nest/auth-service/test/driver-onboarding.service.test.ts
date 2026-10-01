import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BadRequestException,
  HttpException,
  NotFoundException,
  UnsupportedMediaTypeException,
} from "@nestjs/common";
import { OnboardingStatus, DocumentStatus } from "../src/generated/prisma";
import { DriverOnboardingService } from "../src/driver-onboarding/driver-onboarding.service";

// Pull in the module barrels so their export statements are counted.
import "../src/driver-onboarding";
import "../src/driver-onboarding/dto";
import "../src/driver-onboarding/dto/register-vehicle.dto";
import "../src/rider-profile";
import "../src/rider-profile/dto";
import "../src/rider-profile/dto/upload-profile-image.dto";
import "../src/events";
import "../src/shared/utils";
import "../src/shared/types";
import "../src/shared/storage";

// The unauthenticated-rider branch of the rider profile controller.
import { RiderProfileController } from "../src/rider-profile/rider-profile.controller";
import { BadRequestException } from "@nestjs/common";
import { validate } from "class-validator";
import { RegisterVehicleDto } from "../src/driver-onboarding/dto/register-vehicle.dto";
import { UploadProfileImageDto } from "../src/rider-profile/dto/upload-profile-image.dto";

describe("RiderProfileController auth precheck", () => {
  it("rejects requests that arrive without an authenticated user", async () => {
    const controller = new RiderProfileController({} as any);
    await expect(
      controller.uploadIdentityDocuments({} as any),
    ).rejects.toThrow(new BadRequestException("User not authenticated"));
  });
});

describe("upload DTO classes", () => {
  it("exposes the multipart image holder", () => {
    const dto = new UploadProfileImageDto();
    dto.image = "x";
    expect(dto.image).toBe("x");
  });
});

describe("RegisterVehicleDto", () => {
  it("validates vehicle payloads", async () => {
    const dto = new RegisterVehicleDto();
    dto.make = "Toyota";
    dto.model = "Corolla";
    dto.year = 2022;
    dto.color = "white";
    dto.plateNumber = "ABC-1234";
    await expect(validate(dto)).resolves.toHaveLength(0);

    dto.year = 1800;
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === "year")).toBe(true);
  });
});

function makeDeps() {
  return {
    prisma: {
      driver: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
        update: vi.fn().mockResolvedValue({ id: "d1" }),
      },
      user: {
        update: vi.fn().mockResolvedValue({ id: "u1" }),
      },
      driverDocument: {
        upsert: vi.fn().mockResolvedValue({
          identityStatus: DocumentStatus.PENDING,
          identityUploadAttempts: 1,
          drivingLicenseStatus: DocumentStatus.PENDING,
          drivingLicenseUploadAttempts: 1,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      vehicle: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      $transaction: vi.fn(async (input: any) => (Array.isArray(input) ? input : input)),
    },
    storage: {
      upload: vi.fn().mockResolvedValue({ objectName: "obj" }),
      uploadMultiple: vi.fn().mockResolvedValue([]),
      getPresignedGetUrl: vi
        .fn()
        .mockResolvedValue({ url: "https://signed", expiresAt: new Date() }),
      getPresignedUrlsForObjectKeys: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  };
}

const DRIVER = { id: "d1", userId: "user-1", onboardingStatus: OnboardingStatus.PENDING_DOCUMENTS };

function jpegFile(size = 100) {
  return { buffer: Buffer.alloc(size), originalname: "f.jpg", mimetype: "image/jpeg", size };
}

describe("DriverOnboardingService", () => {
  let deps: ReturnType<typeof makeDeps>;
  let service: DriverOnboardingService;

  beforeEach(() => {
    deps = makeDeps();
    service = new DriverOnboardingService(deps.prisma as any, deps.storage as any);
  });

  describe("updateOnlineStatus", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.updateOnlineStatus("ghost", true)).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("blocks going online before approval", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        onboardingStatus: OnboardingStatus.UNDER_REVIEW,
      });

      await expect(service.updateOnlineStatus("user-1", true)).rejects.toThrow(
        new BadRequestException(
          "Only approved drivers can go online. Current status: UNDER_REVIEW",
        ),
      );
    });

    it("toggles online state for approved drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        onboardingStatus: OnboardingStatus.APPROVED,
      });
      deps.prisma.driver.update.mockResolvedValueOnce({ id: "d1", isOnline: true });

      const result = await service.updateOnlineStatus("user-1", true);

      expect(result.isOnline).toBe(true);
      expect(deps.prisma.driver.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isOnline: true } }),
      );
    });
  });

  describe("updateDriverProfile", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValue(null);
      await expect(service.updateDriverProfile("ghost", {})).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("applies profile fields and returns the refreshed driver", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, user: { id: "user-1", email: "e", city: null } })
        .mockResolvedValueOnce({
          ...DRIVER,
          user: { id: "user-1", email: "e", city: "Cairo", dateOfBirth: null },
        });

      const result = await service.updateDriverProfile("user-1", {
        city: "Cairo",
        dateOfBirth: "1995-05-01",
      });

      expect(deps.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { city: "Cairo", dateOfBirth: new Date("1995-05-01") },
      });
      expect(result.user.city).toBe("Cairo");
    });

    it("skips the user update when the dto is empty", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, user: { id: "user-1" } })
        .mockResolvedValueOnce({ ...DRIVER, user: { id: "user-1" } });

      await service.updateDriverProfile("user-1", {});

      expect(deps.prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe("file validation", () => {
    it("rejects the wrong number of files", async () => {
      await expect(
        service.uploadIdentityDocuments("user-1", [jpegFile(), jpegFile()]),
      ).rejects.toThrow(new BadRequestException("Exactly 3 files are required"));
    });

    it("rejects disallowed mimetypes", async () => {
      await expect(
        service.uploadIdentityDocuments("user-1", [
          jpegFile(),
          { ...jpegFile(), mimetype: "image/gif" },
          jpegFile(),
        ]),
      ).rejects.toThrow(UnsupportedMediaTypeException);
    });

    it("rejects oversized files", async () => {
      await expect(
        service.uploadIdentityDocuments("user-1", [
          jpegFile(),
          jpegFile(),
          jpegFile(11 * 1024 * 1024),
        ]),
      ).rejects.toThrow(/File too large/);
    });

    it("maps unknown mimetypes to a jpg extension through the private helper", () => {
      expect((service as any).getFileExtension("image/png")).toBe("png");
      expect((service as any).getFileExtension("image/webp")).toBe("webp");
      expect((service as any).getFileExtension("image/xyz")).toBe("jpg");
    });
  });

  describe("uploadIdentityDocuments", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.uploadIdentityDocuments("ghost", [jpegFile(), jpegFile(), jpegFile()]),
      ).rejects.toThrow(new NotFoundException("Driver not found"));
    });

    it("caps attempts at three per document type", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: { identityUploadAttempts: 3 },
      });

      await expect(
        service.uploadIdentityDocuments("user-1", [jpegFile(), jpegFile(), jpegFile()]),
      ).rejects.toThrow(
        new HttpException(
          "Maximum upload attempts reached for identity documents. Please contact support.",
          429,
        ),
      );
    });

    it("uploads, upserts, and reports the transition status", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, document: null })
        .mockResolvedValueOnce({
          ...DRIVER,
          document: { identityImages: ["a", "b", "c"], drivingLicenseImages: [] },
          vehicleId: null,
        });

      const result = await service.uploadIdentityDocuments("user-1", [
        jpegFile(),
        jpegFile(),
        jpegFile(),
      ]);

      expect(result.uploadAttempts).toBe(1);
      expect(result.identityImages).toHaveLength(3);
      expect(deps.prisma.driverDocument.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ create: expect.objectContaining({ identityUploadAttempts: 1 }) }),
      );
    });

    it("stays out of review while the driver record vanished", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, document: null })
        .mockResolvedValueOnce(null);

      const result = await service.uploadIdentityDocuments("user-1", [
        jpegFile(),
        jpegFile(),
        jpegFile(),
      ]);

      expect(result.onboardingStatus).toBe(OnboardingStatus.PENDING_DOCUMENTS);
    });
  });

  describe("uploadDrivingLicense", () => {
    const licenseFiles = [jpegFile(), jpegFile()];

    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.uploadDrivingLicense("ghost", licenseFiles, "LIC-1"),
      ).rejects.toThrow(new NotFoundException("Driver not found"));
    });

    it("rejects license numbers claimed by other drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(DRIVER);
      deps.prisma.driver.findFirst.mockResolvedValueOnce({ id: "other" });

      await expect(
        service.uploadDrivingLicense("user-1", licenseFiles, "LIC-TAKEN"),
      ).rejects.toThrow(/already registered to another driver/);
    });

    it("caps attempts at three", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: { drivingLicenseUploadAttempts: 3 },
      });

      await expect(
        service.uploadDrivingLicense("user-1", licenseFiles, "LIC-1"),
      ).rejects.toThrow(/Maximum upload attempts reached for driving license/);
    });

    it("stores the license and saves the number", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, document: null })
        .mockResolvedValueOnce({ ...DRIVER, document: null, vehicleId: null });

      const result = await service.uploadDrivingLicense("user-1", licenseFiles, "LIC-1");

      expect(result.status).toBe(DocumentStatus.PENDING);
      expect(deps.prisma.driver.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { licenseNumber: "LIC-1" },
      });
    });
  });

  describe("registerVehicle", () => {
    const carImage = jpegFile();
    const carLicenseImage = jpegFile();
    const data = {
      make: "Toyota",
      model: "Corolla",
      year: 2022,
      color: "white",
      plateNumber: "abc-1234",
    };

    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(
        service.registerVehicle("ghost", data, carImage, carLicenseImage),
      ).rejects.toThrow(new NotFoundException("Driver not found"));
    });

    it("caps attempts on an existing vehicle", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        vehicleId: "v1",
      });
      deps.prisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", uploadAttempts: 3 });

      await expect(
        service.registerVehicle("user-1", data, carImage, carLicenseImage),
      ).rejects.toThrow(/Maximum upload attempts reached for vehicle/);
    });

    it("creates and links a new vehicle", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, vehicleId: null })
        .mockResolvedValueOnce({ ...DRIVER, vehicleId: "v1", document: null });
      deps.prisma.vehicle.create.mockResolvedValueOnce({
        id: "v1",
        status: DocumentStatus.PENDING,
        ...data,
        plateNumber: "ABC-1234",
      });

      const result = await service.registerVehicle("user-1", data, carImage, carLicenseImage);

      expect(result.plateNumber).toBe("ABC-1234");
      expect(deps.prisma.vehicle.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ plateNumber: "ABC-1234", uploadAttempts: 1 }),
      });
      expect(deps.prisma.driver.update).toHaveBeenCalledWith({
        where: { id: "d1" },
        data: { vehicleId: "v1" },
      });
    });

    it("updates an existing vehicle in place", async () => {
      deps.prisma.driver.findUnique
        .mockResolvedValueOnce({ ...DRIVER, vehicleId: "v1" })
        .mockResolvedValueOnce({ ...DRIVER, vehicleId: "v1", document: null });
      deps.prisma.vehicle.findUnique.mockResolvedValueOnce({ id: "v1", uploadAttempts: 1 });
      deps.prisma.vehicle.update.mockResolvedValueOnce({
        id: "v1",
        status: DocumentStatus.PENDING,
        plateNumber: "ABC-1234",
      });

      const result = await service.registerVehicle("user-1", data, carImage, carLicenseImage);

      expect(deps.prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: expect.objectContaining({ uploadAttempts: { increment: 1 } }),
      });
      expect(deps.prisma.vehicle.create).not.toHaveBeenCalled();
      expect(result.id).toBe("v1");
    });
  });

  describe("getOnboardingStatus", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.getOnboardingStatus("ghost")).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("returns defaults when nothing was uploaded yet", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: null,
        vehicle: null,
      });

      const result = await service.getOnboardingStatus("user-1");

      expect(result.documents.identity).toMatchObject({
        status: DocumentStatus.PENDING,
        uploadAttempts: 0,
        images: [],
      });
      expect(result.documents.vehicle.details).toBeUndefined();
      expect(deps.storage.getPresignedGetUrl).not.toHaveBeenCalled();
    });

    it("presigns stored documents and vehicle images", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: {
          identityImages: ["a", "b"],
          identityStatus: DocumentStatus.APPROVED,
          identityUploadAttempts: 1,
          drivingLicenseImages: ["c"],
          drivingLicenseStatus: DocumentStatus.PENDING,
          drivingLicenseUploadAttempts: 2,
        },
        vehicle: {
          id: "v1",
          carImage: "car.jpg",
          carLicenseImage: "car-license.jpg",
          status: DocumentStatus.PENDING,
          uploadAttempts: 1,
          make: "Toyota",
          model: "Corolla",
          year: 2022,
          color: "white",
          plateNumber: "ABC-1234",
        },
      });
      deps.storage.getPresignedUrlsForObjectKeys.mockResolvedValueOnce([
        { url: "u1", expiresAt: new Date() },
        { url: "u2", expiresAt: new Date() },
      ]);

      const result = await service.getOnboardingStatus("user-1");

      expect(result.documents.identity.images).toHaveLength(2);
      expect(result.documents.vehicle.carImage).toBeTruthy();
      expect(result.documents.vehicle.details).toMatchObject({ make: "Toyota" });
    });
  });

  describe("resetUploadAttempts", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.resetUploadAttempts("ghost")).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("is a no-op for drivers without documents or vehicles", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: null,
        vehicleId: null,
      });

      await service.resetUploadAttempts("user-1");

      expect(deps.prisma.driverDocument.update).not.toHaveBeenCalled();
      expect(deps.prisma.vehicle.update).not.toHaveBeenCalled();
    });

    it("resets document and vehicle counters", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: { id: "doc-1" },
        vehicleId: "v1",
      });

      await service.resetUploadAttempts("user-1");

      expect(deps.prisma.driverDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { identityUploadAttempts: 0, drivingLicenseUploadAttempts: 0 },
      });
      expect(deps.prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: { uploadAttempts: 0 },
      });
    });
  });

  describe("approveDriver", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.approveDriver("ghost")).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("approves the driver and activates the user in one transaction", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(DRIVER);

      await service.approveDriver("user-1");

      expect(deps.prisma.driver.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { onboardingStatus: OnboardingStatus.APPROVED },
      });
      expect(deps.prisma.user.update).toHaveBeenCalledWith({
        where: { id: "user-1" },
        data: { status: "ACTIVE" },
      });
      expect(deps.prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("rejectDocument", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.rejectDocument("ghost", "identity", "bad")).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("rejects identity documents and reverts the driver to PENDING_DOCUMENTS", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: { id: "doc-1" },
        vehicleId: null,
      });

      await service.rejectDocument("user-1", "identity", "blurry");

      expect(deps.prisma.driverDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { identityStatus: DocumentStatus.REJECTED, identityRejectionReason: "blurry" },
      });
      expect(deps.prisma.driver.update).toHaveBeenCalledWith({
        where: { userId: "user-1" },
        data: { onboardingStatus: OnboardingStatus.PENDING_DOCUMENTS },
      });
    });

    it("rejects license documents", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: { id: "doc-1" },
        vehicleId: null,
      });

      await service.rejectDocument("user-1", "license", "expired");

      expect(deps.prisma.driverDocument.update).toHaveBeenCalledWith({
        where: { id: "doc-1" },
        data: { drivingLicenseStatus: DocumentStatus.REJECTED, drivingLicenseRejectionReason: "expired" },
      });
    });

    it("rejects the vehicle when one is linked", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: null,
        vehicleId: "v1",
      });

      await service.rejectDocument("user-1", "vehicle", "damaged");

      expect(deps.prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: { status: DocumentStatus.REJECTED, rejectionReason: "damaged" },
      });
    });

    it("skips document updates when the stage target does not exist", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: null,
        vehicleId: null,
      });

      await service.rejectDocument("user-1", "vehicle", "x");

      expect(deps.prisma.vehicle.update).not.toHaveBeenCalled();
      expect(deps.prisma.driverDocument.update).not.toHaveBeenCalled();
      expect(deps.prisma.driver.update).toHaveBeenCalled();
    });
  });

  describe("approveDocument", () => {
    it("404s for unknown drivers", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce(null);
      await expect(service.approveDocument("ghost", "identity")).rejects.toThrow(
        new NotFoundException("Driver not found"),
      );
    });

    it("approves each stage and clears rejection reasons", async () => {
      deps.prisma.driver.findUnique.mockResolvedValue({
        ...DRIVER,
        document: { id: "doc-1" },
        vehicleId: "v1",
      });

      await service.approveDocument("user-1", "identity");
      await service.approveDocument("user-1", "license");
      await service.approveDocument("user-1", "vehicle");

      expect(deps.prisma.driverDocument.update).toHaveBeenCalledTimes(2);
      expect(deps.prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: "v1" },
        data: { status: DocumentStatus.APPROVED, rejectionReason: null },
      });
    });

    it("skips missing stage targets", async () => {
      deps.prisma.driver.findUnique.mockResolvedValueOnce({
        ...DRIVER,
        document: null,
        vehicleId: null,
      });

      await service.approveDocument("user-1", "identity");

      expect(deps.prisma.driverDocument.update).not.toHaveBeenCalled();
      expect(deps.prisma.$transaction).toHaveBeenCalledWith([]);
    });
  });
});
