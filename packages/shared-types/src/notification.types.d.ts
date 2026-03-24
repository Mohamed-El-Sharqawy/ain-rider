export declare enum NotificationType {
    PUSH = "PUSH",
    SMS = "SMS",
    EMAIL = "EMAIL",
    IN_APP = "IN_APP"
}
export declare enum NotificationPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    URGENT = "URGENT"
}
export declare enum NotificationStatus {
    PENDING = "PENDING",
    SENT = "SENT",
    DELIVERED = "DELIVERED",
    FAILED = "FAILED",
    READ = "READ"
}
export interface Notification {
    id: string;
    userId?: string;
    type: NotificationType;
    priority: NotificationPriority;
    status: NotificationStatus;
    title: string;
    body: string;
    data?: Record<string, any>;
    imageUrl?: string;
    actionUrl?: string;
    sentAt?: Date;
    deliveredAt?: Date;
    readAt?: Date;
    createdBy: string;
    createdAt: Date;
}
export interface PushNotificationRequest {
    userIds?: string[];
    title: string;
    body: string;
    data?: Record<string, any>;
    imageUrl?: string;
    actionUrl?: string;
    priority: NotificationPriority;
}
//# sourceMappingURL=notification.types.d.ts.map