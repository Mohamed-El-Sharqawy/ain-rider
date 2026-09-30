import { ApiClient } from './client';

export interface CreateComplaintPayload {
  againstUserId?: string;
  tripId?: string;
  type: string;
  subject: string;
  description: string;
  priority?: string;
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

export interface ComplaintResponse {
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
  resolution?: string;
  createdAt: string;
  updatedAt: string;
  comments?: ComplaintComment[];
}

export const SupportApi = {
  async getMyComplaints(page: number = 1, limit: number = 20): Promise<ComplaintResponse[]> {
    return ApiClient.get<ComplaintResponse[]>(`/support/complaints?page=${page}&limit=${limit}`);
  },

  async getComplaint(id: string): Promise<ComplaintResponse> {
    return ApiClient.get<ComplaintResponse>(`/support/complaints/${id}`);
  },

  async createComplaint(data: CreateComplaintPayload): Promise<ComplaintResponse> {
    return ApiClient.post<ComplaintResponse>('/support/complaints', data);
  },

  async addComment(complaintId: string, comment: string): Promise<ComplaintComment> {
    return ApiClient.post<ComplaintComment>(`/support/complaints/${complaintId}/comments`, { comment });
  },
};
