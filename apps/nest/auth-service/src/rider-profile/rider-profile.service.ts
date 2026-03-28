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

  private getFileExtension(mimetype: string): string {
    const extensions: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    return extensions[mimetype] || "jpg";
  }
}
