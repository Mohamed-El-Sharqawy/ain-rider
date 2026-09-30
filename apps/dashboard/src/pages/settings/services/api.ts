import { api } from '@/api/client';
import type { SettingDTO, UpsertSettingDTO } from './dto';

export const settingsApi = {
  getAll: (category?: string) =>
    api.get<SettingDTO[]>('/admin/settings', { params: category ? { category } : undefined }),

  getByKey: (key: string) =>
    api.get<SettingDTO>(`/admin/settings/${key}`),

  upsert: (key: string, data: UpsertSettingDTO) =>
    api.put<SettingDTO>(`/admin/settings/${key}`, data),

  batchUpsert: (settings: Array<{ key: string; value: unknown; type?: string; category?: string; description?: string; isPublic?: boolean }>) =>
    api.post<{ count: number; settings: SettingDTO[] }>('/admin/settings/batch', { settings }),
};
