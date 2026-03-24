// ─── Notifications Queries ───────────────────────────────────────────────────
// TanStack Query hooks for reading notifications data.

import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from './api'
import { transformNotification } from './transformers'
import { useAuthStore } from '@/stores/authStore'

export const notificationKeys = {
  all: ['notifications'] as const,
  byUser: (userId: string) => ['notifications', 'user', userId] as const,
}

export const useGetAllNotifications = () => {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () =>
      notificationsApi.getAll().then((r) => r.data.map((dto) => transformNotification(dto, user?.id))),
  })
}

export const useGetMyNotifications = () => {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: [...notificationKeys.all, 'me'] as const,
    queryFn: () =>
      notificationsApi.getMyNotifications().then((r) => r.data.map((dto) => transformNotification(dto, user?.id))),
  })
}

export const useGetUserNotifications = (userId: string) => {
  return useQuery({
    queryKey: notificationKeys.byUser(userId),
    queryFn: () =>
      notificationsApi.getByUser(userId).then((r) => r.data.map((dto) => transformNotification(dto, userId))),
    enabled: !!userId,
  })
}
