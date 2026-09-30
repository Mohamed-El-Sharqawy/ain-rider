import {
  Injectable,
  NotFoundException,
  UnsupportedMediaTypeException,
  PayloadTooLargeException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../shared/storage/storage.service";
import type { PresignedUrlResult } from "../shared/storage/storage.service";
import type { UploadedFile } from "../shared/types";

const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IDENTITY_FILE_SIZE = 8 * 1024 * 1024;

@Injectable()
export class RiderProfileService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async uploadProfileImage(
    userId: string,
    file: UploadedFile,
  ): Promise<{ profileImage: PresignedUrlResult }> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Invalid file type: ${file.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new PayloadTooLargeException("File too large. Max size: 10MB");
    }

    const rider = await this.prisma.rider.findUnique({
      where: { userId },
      include: { user: true },
    });

    if (!rider) {
      throw new NotFoundException("Rider not found");
    }

    const existingImage = rider.user.profileImage;
    if (existingImage) {
      try {
        const objectName = existingImage.split("/").slice(-2).join("/");
        await this.storage.delete(`riders/${userId}/profile/${objectName}`);
      } catch {
        // Ignore deletion errors
      }
    }

    const ext = this.getFileExtension(file.mimetype);
    const objectName = `riders/${userId}/profile/${crypto.randomUUID()}.${ext}`;

    await this.storage.upload(objectName, file.buffer, file.size, {
      contentType: file.mimetype,
    });

    const presigned = await this.storage.getPresignedGetUrl(objectName, 3600);

    await this.prisma.user.update({
      where: { id: userId },
      data: { profileImage: objectName },
    });

    return { profileImage: presigned };
  }

  async uploadIdentityDocuments(
    userId: string,
    frontFile: UploadedFile,
    backFile: UploadedFile,
  ): Promise<{ identityFront: PresignedUrlResult; identityBack: PresignedUrlResult }> {
    // Validate front file
    if (!ALLOWED_MIME_TYPES.includes(frontFile.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Invalid front file type: ${frontFile.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }
    if (frontFile.size > MAX_IDENTITY_FILE_SIZE) {
      throw new PayloadTooLargeException("Front file too large. Max size: 8MB");
    }

    // Validate back file
    if (!ALLOWED_MIME_TYPES.includes(backFile.mimetype)) {
      throw new UnsupportedMediaTypeException(
        `Invalid back file type: ${backFile.mimetype}. Allowed: ${ALLOWED_MIME_TYPES.join(", ")}`,
      );
    }
    if (backFile.size > MAX_IDENTITY_FILE_SIZE) {
      throw new PayloadTooLargeException("Back file too large. Max size: 8MB");
    }

    const rider = await this.prisma.rider.findUnique({
      where: { userId },
    });

    if (!rider) {
      throw new NotFoundException("Rider not found");
    }

    // Delete existing files if present
    if (rider.identityFront) {
      try {
        await this.storage.delete(rider.identityFront);
      } catch {
        // Ignore deletion errors
      }
    }
    if (rider.identityBack) {
      try {
        await this.storage.delete(rider.identityBack);
      } catch {
        // Ignore deletion errors
      }
    }

    // Generate object names with proper extensions
    const frontExt = this.getFileExtension(frontFile.mimetype);
    const backExt = this.getFileExtension(backFile.mimetype);
    const frontObjectName = `riders/${userId}/identity/front.${frontExt}`;
    const backObjectName = `riders/${userId}/identity/back.${backExt}`;

    // Upload both files to MinIO
    await this.storage.uploadMultiple([
      {
        objectName: frontObjectName,
        data: frontFile.buffer,
        contentType: frontFile.mimetype,
      },
      {
        objectName: backObjectName,
        data: backFile.buffer,
        contentType: backFile.mimetype,
      },
    ]);

    // Get presigned URLs for response
    const [frontPresigned, backPresigned] = await Promise.all([
      this.storage.getPresignedGetUrl(frontObjectName, 3600),
      this.storage.getPresignedGetUrl(backObjectName, 3600),
    ]);

    // Update Rider record with both URLs
    await this.prisma.rider.update({
      where: { userId },
      data: {
        identityFront: frontObjectName,
        identityBack: backObjectName,
      },
    });

    return {
      identityFront: frontPresigned,
      identityBack: backPresigned,
    };
  }

  private getFileExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return extensions[mimetype] || "jpg";
  }
}
