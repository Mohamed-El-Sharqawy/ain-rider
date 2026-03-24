import { Injectable, NotFoundException } from '@nestjs/common';
import { AuthDbService } from '../prisma/auth-db.service';
import { StorageService } from '../shared/storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ProfileService {
  constructor(
    private authDb: AuthDbService,
    private storage: StorageService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.authDb.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    const user = await this.authDb.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Note: Profile updates should go through auth-service via NATS
    // For now, we directly update the auth database (read-write for profile updates)
    return this.authDb.user.update({
      where: { id: userId },
      data: {
        ...(data.firstName && { firstName: data.firstName }),
        ...(data.lastName && { lastName: data.lastName }),
        ...(data.email && { email: data.email }),
        ...(data.phoneNumber && { phoneNumber: data.phoneNumber }),
        ...(data.profileImage && { profileImage: data.profileImage }),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        phoneNumber: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        profileImage: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async generateUploadUrl(userId: string, fileName: string, _contentType: string) {
    const ext = fileName.split('.').pop() || 'jpg';
    const objectName = `profiles/${userId}/${randomUUID()}.${ext}`;

    const result = await this.storage.getPresignedPutUrl(objectName, 300);

    return {
      uploadUrl: result.url,
      objectName,
      expiresAt: result.expiresAt,
      publicUrl: this.buildPublicUrl(objectName),
    };
  }

  async deleteProfileImage(userId: string) {
    const user = await this.authDb.user.findUnique({
      where: { id: userId },
      select: { profileImage: true },
    });

    if (!user || !user.profileImage) {
      return;
    }

    const objectName = this.extractObjectNameFromUrl(user.profileImage);
    if (objectName) {
      await this.storage.delete(objectName);
    }

    await this.authDb.user.update({
      where: { id: userId },
      data: { profileImage: null, updatedAt: new Date() },
    });
  }

  private buildPublicUrl(objectName: string): string {
    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const scheme = useSSL ? 'https' : 'http';
    const bucket = process.env.MINIO_DEFAULT_BUCKET || 'ain-rider';
    
    const portSuffix = (useSSL && port === '443') || (!useSSL && port === '80') ? '' : `:${port}`;
    return `${scheme}://${endpoint}${portSuffix}/${bucket}/${objectName}`;
  }

  private extractObjectNameFromUrl(url: string): string | null {
    try {
      const bucket = process.env.MINIO_DEFAULT_BUCKET || 'ain-rider';
      const parts = url.split(`/${bucket}/`);
      return parts.length > 1 ? parts[1] : null;
    } catch {
      return null;
    }
  }
}
