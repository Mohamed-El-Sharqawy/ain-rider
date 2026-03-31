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
  status?: string;
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

/* Driver Specific Types */

export enum DriverOnboardingStatus {
  PENDING_DOCUMENTS = 'PENDING_DOCUMENTS',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export interface DocumentStatus {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  images: PresignedUrlResult[];
  uploadAttempts: number;
  rejectionReason?: string;
}

export interface OnboardingStatusResponse {
  onboardingStatus: DriverOnboardingStatus;
  documents: {
    identity: {
      status: string;
      uploadAttempts: number;
      rejectionReason?: string;
      images: PresignedUrlResult[];
    };
    drivingLicense: {
      status: string;
      uploadAttempts: number;
      rejectionReason?: string;
      images: PresignedUrlResult[];
    };
    vehicle: {
      status: string;
      uploadAttempts: number;
      rejectionReason?: string;
      carImage?: PresignedUrlResult;
      carLicenseImage?: PresignedUrlResult;
      details?: {
        make: string;
        model: string;
        year: number;
        color: string;
        plateNumber: string;
      };
    };
  };
}

export interface UpdateDriverProfilePayload {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  dateOfBirth?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

export interface VehicleRegistrationPayload {
  make: string;
  model: string;
  year: number;
  color: string;
  plateNumber: string;
}

export interface VehicleRegistrationResponse {
  success: boolean;
  data: {
    vehicle: {
      id: string;
      make: string;
      model: string;
      year: number;
      color: string;
      plateNumber: string;
    };
    carImage: PresignedUrlResult;
    carLicenseImage: PresignedUrlResult;
  };
}

export interface VehicleMake {
  id: string;
  name: string;
  isActive: boolean;
}

export interface VehicleModel {
  id: string;
  makeId: string;
  name: string;
  vehicleTypeId?: string;
  isActive: boolean;
}
