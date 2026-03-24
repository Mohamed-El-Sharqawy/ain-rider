export declare enum ComplaintType {
    DRIVER_BEHAVIOR = "DRIVER_BEHAVIOR",
    RIDER_BEHAVIOR = "RIDER_BEHAVIOR",
    VEHICLE_CONDITION = "VEHICLE_CONDITION",
    ROUTE_ISSUE = "ROUTE_ISSUE",
    PAYMENT_ISSUE = "PAYMENT_ISSUE",
    SAFETY_CONCERN = "SAFETY_CONCERN",
    APP_ISSUE = "APP_ISSUE",
    OTHER = "OTHER"
}
export declare enum ComplaintStatus {
    PENDING = "PENDING",
    UNDER_REVIEW = "UNDER_REVIEW",
    RESOLVED = "RESOLVED",
    REJECTED = "REJECTED",
    ESCALATED = "ESCALATED"
}
export declare enum ComplaintPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH",
    CRITICAL = "CRITICAL"
}
export interface Complaint {
    id: string;
    complainantId: string;
    complainantRole: 'RIDER' | 'DRIVER';
    againstUserId?: string;
    tripId?: string;
    type: ComplaintType;
    status: ComplaintStatus;
    priority: ComplaintPriority;
    subject: string;
    description: string;
    evidence?: string[];
    assignedTo?: string;
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
    isInternal: boolean;
    createdAt: Date;
}
//# sourceMappingURL=complaint.types.d.ts.map