// ─── Notifications API ───────────────────────────────────────────────────────
// Raw HTTP calls for the notifications domain.

import { api } from '@/api/client'
import type { NotificationDTO, CreateNotificationDTO, SendPushDTO, SendSmsDTO } from './dto'

export const notificationsApi = {
  getAll: () =>
    api.get<NotificationDTO[]>('/admin/notifications'),

  getMyNotifications: () =>
    api.get<NotificationDTO[]>('/admin/notifications/me'),

  getByUser: (userId: string) =>
    api.get<NotificationDTO[]>(`/admin/notifications/user/${userId}`),

  create: (data: CreateNotificationDTO) =>
    api.post<NotificationDTO>('/admin/notifications', data),

  sendPush: (data: SendPushDTO) =>
    api.post<NotificationDTO>('/admin/notifications/push', data),

  sendSms: (data: SendSmsDTO) =>
    api.post<{ success: boolean; message: string }>('/admin/notifications/sms', data),

  markRead: (id: string) =>
    api.patch<NotificationDTO>(`/admin/notifications/${id}/read`),

  markAllAsRead: () =>
    api.patch<{ count: number }>('/admin/notifications/read-all'),
}
