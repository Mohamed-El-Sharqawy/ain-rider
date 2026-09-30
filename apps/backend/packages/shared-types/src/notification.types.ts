export enum NotificationType {
  PUSH = 'PUSH',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
  IN_APP = 'IN_APP',
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum NotificationStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  READ = 'READ',
}

export interface Notification {
  id: string;
  userId?: string; // null for broadcast
  type: NotificationType;
  priority: NotificationPriority;
  status: NotificationStatus;
  title: string;
  body: string;
  data?: Record<string, any>; // Additional payload
  imageUrl?: string;
  actionUrl?: string;
  sentAt?: Date;
  deliveredAt?: Date;
  readAt?: Date;
  createdBy: string; // Admin user ID
  createdAt: Date;
}

export interface PushNotificationRequest {
  userIds?: string[]; // Specific users or null for broadcast
  title: string;
  body: string;
  data?: Record<string, any>;
  imageUrl?: string;
  actionUrl?: string;
  priority: NotificationPriority;
}
