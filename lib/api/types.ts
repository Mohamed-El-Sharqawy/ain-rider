export interface PhoneVerificationResult {
  success: boolean;
  isRegistered: boolean;
  accessToken?: string;
  refreshToken?: string;
  user?: User;
}

export interface OtpRequestPayload {
  phone: string;
}

export interface OtpVerifyPayload {
  phone: string;
  code: string;
}

export interface ApiErrorResponse {
  message: string;
  error?: {
    message: string;
  };
  retryAfterSeconds?: number;
}

export enum UserRole {
  RIDER = 'RIDER',
  DRIVER = 'DRIVER',
  SUPPORT = 'SUPPORT',
  ADMIN = 'ADMIN',
}

export interface User {
  id: string;
  email: string;
  phoneNumber: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export interface RegisterPayload {
  email: string;
  phoneNumber: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole.RIDER | UserRole.DRIVER;
}

export interface RegisterResponse {
  success: boolean;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface ProfileImageResponse {
  success: boolean;
  data: {
    profileImage: PresignedUrlResult;
  };
}

export interface UserImages {
  profileImage?: PresignedUrlResult | null;
  identityFront?: PresignedUrlResult | null;
  identityBack?: PresignedUrlResult | null;
}

export interface MeResponse extends User {
  images: UserImages;
}

export interface PresignedUrlResult {
  url: string;
  expiresAt: string;
}

export interface IdentityUploadResponse {
  success: boolean;
  data: {
    identityFront: PresignedUrlResult;
    identityBack: PresignedUrlResult;
  };
}
