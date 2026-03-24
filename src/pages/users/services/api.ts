import { api } from '@/api/client';
import type { UserDTO, UserStatsDTO, PaginatedUsersDTO, UpdateUserStatusDTO, CreateUserDTO } from './dto';

export interface UserFilters {
  search?: string;
  role?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export const usersApi = {
  getAll: (filters: UserFilters) =>
    api.get<PaginatedUsersDTO>('/admin/users', { params: filters }),

  getById: (id: string) =>
    api.get<UserDTO>(`/admin/users/${id}`),

  getStats: () =>
    api.get<UserStatsDTO>('/admin/users/stats'),

  updateStatus: (id: string, data: UpdateUserStatusDTO) =>
    api.patch<{ success: boolean; message: string }>(`/admin/users/${id}/status`, data),

  create: (data: CreateUserDTO) =>
    api.post<UserDTO>('/auth/register', data),
};
