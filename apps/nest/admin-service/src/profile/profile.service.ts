import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalApiClient } from '../shared/internal-api/internal-api.client';
import { StorageService } from '../shared/storage/storage.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { randomUUID } from 'crypto';

@Injectable()
export class ProfileService {
  private readonly authUrl: string;

  constructor(
    private configService: ConfigService,
    private internalApi: InternalApiClient,
    private storage: StorageService,
  ) {
    this.authUrl = this.configService.get<string>('AUTH_SERVICE_URL') || 'http://localhost:4000';
  }

  async getProfile(userId: string) {
    return this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users/${userId}`);
  }

  async updateProfile(userId: string, data: UpdateProfileDto) {
    return this.internalApi.fetchInternal(`${this.authUrl}/auth/admin/users/${userId}`, 'PATCH', data);
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
    const user = await this.getProfile(userId);

    if (!user || !(user as any).profileImage) {
      return;
    }

    const objectName = this.extractObjectNameFromUrl((user as any).profileImage);
    if (objectName) {
      await this.storage.delete(objectName);
    }

    await this.updateProfile(userId, { profileImage: null } as any);
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
