import { api } from '@/api/client';
import type { PromoDTO, CreatePromoDTO, UpdatePromoDTO } from './dto';

export const promosApi = {
  getAll: (status?: string) =>
    api.get<PromoDTO[]>('/admin/promos', { params: { status } }),

  getByCode: (code: string) =>
    api.get<PromoDTO>(`/admin/promos/${code}`),

  create: (data: CreatePromoDTO) =>
    api.post<PromoDTO>('/admin/promos', data),

  update: (id: string, data: UpdatePromoDTO) =>
    api.patch<PromoDTO>(`/admin/promos/${id}`, data),
};
