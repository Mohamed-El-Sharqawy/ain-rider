// ─── Notifications Queries ───────────────────────────────────────────────────
// TanStack Query hooks for reading notifications data.

import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from './api'
import { transformNotification } from './transformers'
import { useAuthStore } from '@/stores/authStore'

export const notificationKeys = {
  all: ['notifications'] as const,
  me: () => [...notificationKeys.all, 'me'] as const,
  byUser: (userId: string) => [...notificationKeys.all, 'user', userId] as const,
}

export const useGetAllNotifications = () => {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: notificationKeys.all,
    queryFn: () =>
      notificationsApi.getAll().then((r) => r.data.map((dto) => transformNotification(dto, user?.id))),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

export const useGetMyNotifications = () => {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: notificationKeys.me(),
    queryFn: () =>
      notificationsApi.getMyNotifications().then((r) => r.data.map((dto) => transformNotification(dto, user?.id))),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

export const useGetUserNotifications = (userId: string) => {
  return useQuery({
    queryKey: notificationKeys.byUser(userId),
    queryFn: () =>
      notificationsApi.getByUser(userId).then((r) => r.data.map((dto) => transformNotification(dto, userId))),
    enabled: !!userId,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}
