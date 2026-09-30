// ─── Notifications DTO ───────────────────────────────────────────────────────
// Mirrors the backend API response shape exactly.

export interface NotificationReadDTO {
  id: string
  notificationId: string
  readerId: string
  readAt: string
}

export interface NotificationDTO {
  id: string
  userId: string | null
  title: string
  body: string
  type: string
  priority: string
  status: string
  data: Record<string, unknown> | null
  imageUrl: string | null
  actionUrl: string | null
  createdAt: string
  sentAt: string | null
  deliveredAt: string | null
  readAt: string | null
  createdBy: string
  reads: NotificationReadDTO[]
}

export interface CreateNotificationDTO {
  userId: string
  title: string
  body: string
  type: string
  data?: Record<string, unknown>
}

export interface SendPushDTO {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

export interface SendSmsDTO {
  phoneNumber: string
  message: string
}
