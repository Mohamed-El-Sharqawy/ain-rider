export interface ProfileDTO {
  id: string
  email: string
  phoneNumber: string
  firstName: string
  lastName: string
  role: string
  status: string
  profileImage: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateProfileDTO {
  firstName?: string
  lastName?: string
  email?: string
  phoneNumber?: string
  profileImage?: string
}

export interface UploadUrlResponseDTO {
  uploadUrl: string
  objectName: string
  expiresAt: string
  publicUrl: string
}
