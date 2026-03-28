export interface PresignedUrlDto {
  url: string;
  expiresAt: Date;
}

export interface DocumentStatusDto {
  status: "PENDING" | "APPROVED" | "REJECTED";
  uploadAttempts: number;
  rejectionReason?: string;
  images: PresignedUrlDto[];
}

export interface OnboardingDocumentsDto {
  identity: DocumentStatusDto;
  drivingLicense: DocumentStatusDto;
  vehicle: DocumentStatusDto;
}

export interface OnboardingStatusResponseDto {
  onboardingStatus:
    | "PENDING_DOCUMENTS"
    | "UNDER_REVIEW"
    | "APPROVED"
    | "REJECTED";
  approvedAt?: Date;
  documents: OnboardingDocumentsDto;
}
