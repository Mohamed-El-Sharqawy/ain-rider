// ─── Notification Store ─────────────────────────────────────────────────────
// Manages notification state for real-time updates and unread count.

import { create } from 'zustand'

export interface NotificationItem {
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

interface NotificationState {
  notifications: NotificationItem[]
  unreadCount: number
  setNotifications: (notifications: NotificationItem[]) => void
  addNotification: (notification: NotificationItem) => void
  markAsRead: (id: string) => void
  markAllAsRead: () => void
  incrementUnread: () => void
  setUnreadCount: (count: number) => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  unreadCount: 0,
  setNotifications: (notifications) =>
    set({
      notifications,
      unreadCount: notifications.filter((n) => !n.isRead).length,
    }),
  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: notification.isRead ? state.unreadCount : state.unreadCount + 1,
    })),
  markAsRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, isRead: true, readAt: new Date().toISOString() } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    })),
  markAllAsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({
        ...n,
        isRead: true,
        readAt: n.readAt ?? new Date().toISOString(),
      })),
      unreadCount: 0,
    })),
  incrementUnread: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  setUnreadCount: (count) => set({ unreadCount: count }),
}))
