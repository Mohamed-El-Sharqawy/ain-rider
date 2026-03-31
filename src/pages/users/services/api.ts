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

  create: (data: CreateUserDTO) => {
    // Always use admin endpoint when creating users from dashboard
    // This doesn't store tokens since admin is creating, not logging in
    return api.post<UserDTO>('/auth/admin/create-user', data);
  },
};
