import { api } from '@/api/client';
import type { ComplaintDTO, CreateComplaintDTO, AddComplaintCommentDTO } from './dto';

export const complaintsApi = {
  getAll: (status?: string) =>
    api.get<ComplaintDTO[]>('/admin/complaints', { params: { status } }),

  getById: (id: string) =>
    api.get<ComplaintDTO>(`/admin/complaints/${id}`),

  create: (data: CreateComplaintDTO) =>
    api.post<ComplaintDTO>('/admin/complaints', data),

  updateStatus: (id: string, data: { status: string; assignedTo?: string; resolution?: string }) =>
    api.patch<ComplaintDTO>(`/admin/complaints/${id}/status`, data),

  addComment: (id: string, data: AddComplaintCommentDTO) =>
    api.post<ComplaintDTO>(`/admin/complaints/${id}/comments`, data),
};
