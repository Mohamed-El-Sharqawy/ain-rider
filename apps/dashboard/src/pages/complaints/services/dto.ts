export interface ComplaintDTO {
  id: string;
  complainantId: string;
  complainantRole: string;
  againstUserId?: string;
  tripId?: string;
  type: string;
  status: string;
  priority: string;
  subject: string;
  description: string;
  evidence?: unknown;
  assignedTo?: string;
  resolution?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: ComplaintCommentDTO[];
}

export interface ComplaintCommentDTO {
  id: string;
  complaintId: string;
  userId: string;
  userRole: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

export interface CreateComplaintDTO {
  complainantId: string;
  complainantRole: string;
  againstUserId?: string;
  tripId?: string;
  type: string;
  subject: string;
  description: string;
  priority?: string;
  evidence?: unknown;
}

export interface AddComplaintCommentDTO {
  comment: string;
  isInternal?: boolean;
}
