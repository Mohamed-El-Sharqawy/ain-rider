import { api } from '@/api/client';
import type {
  UserDTO,
  UserStatsDTO,
  PaginatedUsersDTO,
  LegacyPaginatedUsersDTO,
  UpdateUserStatusDTO,
  CreateUserDTO,
} from './dto';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  getAll: (filters: UserFilters) =>
    api.get<PaginatedUsersDTO | LegacyPaginatedUsersDTO>('/admin/users', { params: filters }),

  getById: (id: string) =>
    api.get<UserDTO>(`/admin/users/${id}`),

  getStats: () =>
    api.get<UserStatsDTO>('/admin/users/stats'),

  updateStatus: (id: string, data: UpdateUserStatusDTO) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/status`, data),

  getOnboardingStatus: (id: string) =>
    api.get<any>(`/admin/users/${id}/onboarding-status`),

  approveDriver: (id: string) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/approve-driver`, {}),

  rejectDocument: (id: string, stage: string, reason: string) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/reject-document`, { stage, reason }),

  approveDocument: (id: string, stage: string) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/approve-document`, { stage }),

  create: (data: CreateUserDTO) =>
    api.post<UserDTO>('/admin/users', data),
  resetUploadAttempts: (id: string) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/reset-attempts`, {}),
};
