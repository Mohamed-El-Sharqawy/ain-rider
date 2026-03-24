export enum ComplaintType {
  DRIVER_BEHAVIOR = 'DRIVER_BEHAVIOR',
  RIDER_BEHAVIOR = 'RIDER_BEHAVIOR',
  VEHICLE_CONDITION = 'VEHICLE_CONDITION',
  ROUTE_ISSUE = 'ROUTE_ISSUE',
  PAYMENT_ISSUE = 'PAYMENT_ISSUE',
  SAFETY_CONCERN = 'SAFETY_CONCERN',
  APP_ISSUE = 'APP_ISSUE',
  OTHER = 'OTHER',
}

export enum ComplaintStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  REJECTED = 'REJECTED',
  ESCALATED = 'ESCALATED',
}

export enum ComplaintPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export interface Complaint {
  id: string;
  complainantId: string; // User who filed complaint
  complainantRole: 'RIDER' | 'DRIVER';
  againstUserId?: string; // User being complained about
  tripId?: string;
  type: ComplaintType;
  status: ComplaintStatus;
  priority: ComplaintPriority;
  subject: string;
  description: string;
  evidence?: string[]; // URLs to images/videos
  assignedTo?: string; // Support/Admin user ID
  resolution?: string;
  resolutionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
}

export interface ComplaintComment {
  id: string;
  complaintId: string;
  userId: string;
  userRole: 'USER' | 'ADMIN' | 'SUPPORT';
  comment: string;
  isInternal: boolean; // Internal notes vs user-visible
  createdAt: Date;
}
