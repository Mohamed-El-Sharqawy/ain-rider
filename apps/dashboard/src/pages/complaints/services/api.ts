import { api } from '@/api/client';
import type { ComplaintDTO, CreateComplaintDTO, AddComplaintCommentDTO } from './dto';

export interface ComplaintFilters {
  status?: string;
  page?: number;
  limit?: number;
}

export const complaintsApi = {
  getAll: (params: ComplaintFilters) =>
    api.get<{ data: ComplaintDTO[]; total: number; page: number; limit: number; totalPages: number }>('/admin/complaints', { params }),

  getById: (id: string) =>
    api.get<ComplaintDTO>(`/admin/complaints/${id}`),

  create: (data: CreateComplaintDTO) =>
    api.post<ComplaintDTO>('/admin/complaints', data),

  updateStatus: (id: string, data: { status: string; assignedTo?: string; resolution?: string }) =>
    api.patch<ComplaintDTO>(`/admin/complaints/${id}/status`, data),

  addComment: (id: string, data: AddComplaintCommentDTO) =>
    api.post<ComplaintDTO>(`/admin/complaints/${id}/comments`, data),
};
