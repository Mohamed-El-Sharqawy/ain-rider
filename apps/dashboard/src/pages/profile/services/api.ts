import { api } from '@/api/client'
import type { ProfileDTO, UpdateProfileDTO, UploadUrlResponseDTO } from './dto'

export const profileApi = {
  getProfile: () => api.get<ProfileDTO>('/admin/profile'),

  updateProfile: (data: UpdateProfileDTO) =>
    api.patch<ProfileDTO>('/admin/profile', data),

  generateUploadUrl: (fileName: string, contentType: string) =>
    api.post<UploadUrlResponseDTO>('/admin/profile/upload-url', {
      fileName,
      contentType,
    }),

  deleteProfileImage: () => api.delete('/admin/profile/image'),

  uploadToMinIO: (url: string, file: File) =>
    // MinIO presigned URL pattern: server generates a PUT-signed URL via generateUploadUrl(),
    // client uploads directly to MinIO storage bypassing the backend, then confirms completion
    fetch(url, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    }),
}
