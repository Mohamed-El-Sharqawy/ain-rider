import type { ComplaintDTO, ComplaintCommentDTO } from './dto';

export interface Complaint {
  id: string;
  complainantId: string;
  complainantRole: string;
  againstUserId?: string;
  tripId?: string;
  type: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  assignedTo?: string;
  resolution?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  comments: ComplaintComment[];
}

export interface ComplaintComment {
  id: string;
  complaintId: string;
  userId: string;
  userRole: string;
  comment: string;
  isInternal: boolean;
  createdAt: string;
}

export function transformComplaint(dto: ComplaintDTO): Complaint {
  return {
    id: dto.id,
    complainantId: dto.complainantId,
    complainantRole: dto.complainantRole,
    againstUserId: dto.againstUserId,
    tripId: dto.tripId,
    type: dto.type,
    subject: dto.subject,
    description: dto.description,
    status: dto.status,
    priority: dto.priority,
    assignedTo: dto.assignedTo,
    resolution: dto.resolution,
    resolutionNotes: dto.resolutionNotes,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    resolvedAt: dto.resolvedAt,
    comments: (dto.comments || []).map(transformComplaintComment),
  };
}

export function transformComplaintComment(dto: ComplaintCommentDTO): ComplaintComment {
  return {
    id: dto.id,
    complaintId: dto.complaintId,
    userId: dto.userId,
    userRole: dto.userRole,
    comment: dto.comment,
    isInternal: dto.isInternal,
    createdAt: dto.createdAt,
  };
}
