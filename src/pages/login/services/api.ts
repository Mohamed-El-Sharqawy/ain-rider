import { api } from '@/api/client';
import type { LoginDTO, LoginResponseDTO, AuthUserDTO } from './dto';

export const authApi = {
  login: (data: LoginDTO) =>
    api.post<LoginResponseDTO>('/auth/login', data),

  getMe: () =>
    api.get<AuthUserDTO>('/auth/me'),

  logout: () =>
    api.post<{ success: boolean }>('/auth/logout'),
};
