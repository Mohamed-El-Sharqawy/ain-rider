// ─── Notification Bell ──────────────────────────────────────────────────────
// Real-time notification bell with dropdown for the topbar.

import { useEffect } from 'react'
import { Bell, CheckCheck } from 'lucide-react'
import { useNavigate } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useNotificationStore } from '@/stores/notificationStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useMarkNotificationRead, useMarkAllNotificationsRead } from '@/pages/notifications/services/mutations'
import { useGetAllNotifications, notificationKeys } from '@/pages/notifications/services/queries'
import { formatRelativeTime } from '@/lib/utils'

interface NotificationData {
  userId: string
  title: string
  body: string
  notificationId?: string
  data?: Record<string, unknown>
}

export function NotificationBell() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { on, isConnected } = useWebSocket()
  const { notifications, unreadCount, addNotification, markAsRead, markAllAsRead, setNotifications } = useNotificationStore()
  const { mutate: markRead } = useMarkNotificationRead()
  const { mutate: markAllRead } = useMarkAllNotificationsRead()
  const { data: fetchedNotifications } = useGetAllNotifications()

  // Sync fetched notifications to store
  useEffect(() => {
    if (fetchedNotifications) {
      setNotifications(fetchedNotifications.map((n) => ({
        id: n.id,
        userId: n.userId,
        title: n.title,
        body: n.body,
        type: n.type,
        data: n.data,
        isRead: n.isRead,
        createdAt: n.createdAt,
        readAt: n.readAt,
      })))
    }
  }, [fetchedNotifications, setNotifications])

  // Listen for real-time notifications
  useEffect(() => {
    if (!isConnected) return

    const unsubscribe = on('notification', (data: unknown) => {
      const notificationData = data as NotificationData
      addNotification({
        id: notificationData.notificationId ?? crypto.randomUUID(),
        userId: notificationData.userId,
        title: notificationData.title,
        body: notificationData.body,
        type: 'PUSH',
        data: notificationData.data ?? null,
        isRead: false,
        createdAt: new Date().toISOString(),
        readAt: null,
      })
      // Invalidate query to refetch
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    })

    return unsubscribe
  }, [isConnected, on, addNotification, queryClient])

  const handleMarkAsRead = (id: string) => {
    markAsRead(id)
    markRead(id)
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    markAllRead()
  }

  const handleViewAll = () => {
    navigate('/notifications')
  }

  const recentNotifications = notifications.slice(0, 5)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="p-2 rounded-full transition-colors relative"
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-muted)')}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          aria-label="الإشعارات"
        >
          <Bell size={20} style={{ color: 'var(--color-foreground)' }} />
          {unreadCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white px-1"
              style={{ backgroundColor: 'var(--color-destructive)' }}
            >
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>الإشعارات</span>
          {isConnected ? (
            <span className="text-xs font-normal flex items-center gap-1" style={{ color: 'var(--color-success)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              متصل
            </span>
          ) : (
            <span className="text-xs font-normal" style={{ color: 'var(--color-muted-foreground)' }}>
              غير متصل
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {recentNotifications.length === 0 ? (
          <div className="py-8 text-center" style={{ color: 'var(--color-muted-foreground)' }}>
            <Bell size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">لا توجد إشعارات</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            {recentNotifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                style={{
                  backgroundColor: notification.isRead ? 'transparent' : 'var(--color-muted)',
                }}
                onClick={() => !notification.isRead && handleMarkAsRead(notification.id)}
              >
                <div className="flex items-start justify-between w-full gap-2">
                  <p className="font-medium text-sm" style={{ color: 'var(--color-foreground)' }}>
                    {notification.title}
                  </p>
                  {!notification.isRead && (
                    <span
                      className="w-2 h-2 rounded-full shrink-0 mt-1.5"
                      style={{ backgroundColor: 'var(--color-primary)' }}
                    />
                  )}
                </div>
                <p className="text-xs line-clamp-2" style={{ color: 'var(--color-muted-foreground)' }}>
                  {notification.body}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--color-muted-foreground)' }}>
                  {formatRelativeTime(notification.createdAt)}
                </p>
              </DropdownMenuItem>
            ))}
          </ScrollArea>
        )}

        <DropdownMenuSeparator />
        <div className="p-2 flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={handleViewAll}>
            عرض الكل
          </Button>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="gap-1" onClick={handleMarkAllAsRead}>
              <CheckCheck size={14} />
              قراءة الكل
            </Button>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
