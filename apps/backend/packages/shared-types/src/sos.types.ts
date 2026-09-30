export enum SOSStatus {
  ACTIVE = 'ACTIVE',
  RESOLVED = 'RESOLVED',
  CANCELLED = 'CANCELLED',
  FALSE_ALARM = 'FALSE_ALARM',
}

export enum SOSPriority {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
}

export interface SOS {
  id: string;
  userId: string;
  tripId?: string;
  status: SOSStatus;
  priority: SOSPriority;
  location: {
    latitude: number;
    longitude: number;
  };
  address: string;
  reason?: string;
  notes?: string;
  emergencyContacts: string[]; // Phone numbers notified
  respondedBy?: string; // Admin/Support user ID
  responseNotes?: string;
  createdAt: Date;
  resolvedAt?: Date;
  updatedAt: Date;
}

export interface SOSContact {
  id: string;
  userId: string;
  name: string;
  phoneNumber: string;
  relationship: string;
  isPrimary: boolean;
  createdAt: Date;
}
