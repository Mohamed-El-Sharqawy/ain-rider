// ─── Notifications Mutations ─────────────────────────────────────────────────
// TanStack Query mutation hooks for mutating notifications data.

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notificationsApi } from './api'
import { notificationKeys } from './queries'
import { getApiError } from '@/api/client'
import { toast } from 'sonner'
import type { CreateNotificationDTO, SendPushDTO, SendSmsDTO } from './dto'

export const useCreateNotification = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreateNotificationDTO) => notificationsApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.byUser(variables.userId) })
      toast.success('تم إنشاء الإشعار بنجاح')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export const useSendPush = () => {
  return useMutation({
    mutationFn: (data: SendPushDTO) => notificationsApi.sendPush(data),
    onSuccess: () => {
      toast.success('تم إرسال الإشعار بنجاح')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export const useSendSms = () => {
  return useMutation({
    mutationFn: (data: SendSmsDTO) => notificationsApi.sendSms(data),
    onSuccess: () => {
      toast.success('تم إرسال الرسالة النصية بنجاح')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export const useMarkNotificationRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}

export const useMarkAllNotificationsRead = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => notificationsApi.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
      toast.success('تم تحديد جميع الإشعارات كمقروءة')
    },
    onError: (err) => {
      toast.error(getApiError(err))
    },
  })
}
