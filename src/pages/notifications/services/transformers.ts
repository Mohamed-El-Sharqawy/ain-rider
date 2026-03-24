// ─── Notifications Transformers ──────────────────────────────────────────────
// Transforms raw backend DTOs into clean app models.

import type { NotificationDTO } from './dto'

export interface Notification {
  id: string
  userId: string
  title: string
  body: string
  type: string
  data: Record<string, unknown> | null
  isRead: boolean
  createdAt: string
  readAt: string | null
}

export function transformNotification(dto: NotificationDTO, currentUserId?: string): Notification {
  const isRead = currentUserId
    ? dto.reads.some((r) => r.readerId === currentUserId)
    : dto.readAt !== null

  return {
    id: dto.id,
    userId: dto.userId ?? '',
    title: dto.title,
    body: dto.body,
    type: dto.type,
    data: dto.data,
    isRead,
    createdAt: dto.createdAt,
    readAt: dto.reads.find((r) => r.readerId === (currentUserId ?? dto.userId ?? ''))?.readAt ?? dto.readAt,
  }
}
