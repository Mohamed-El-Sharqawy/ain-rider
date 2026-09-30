import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { PageHeader } from '@/components/shared/PageHeader'
import { SendNotificationModal } from './components/SendNotificationModal'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWebSocket } from '@/providers/WebSocketProvider'
import { useNotificationStore } from '@/stores/notificationStore'
import { useMarkNotificationRead, useMarkAllNotificationsRead } from './services/mutations'
import { useGetAllNotifications, useGetMyNotifications, notificationKeys } from './services/queries'
import type { Notification } from './services/transformers'
import { formatRelativeTime } from '@/lib/utils'
import { Bell, MessageSquare, Mail, Wifi, CheckCheck } from 'lucide-react'

export function NotificationsPage() {
  const queryClient = useQueryClient()
  const { on, isConnected } = useWebSocket()
  const { unreadCount, markAsRead, markAllAsRead, setNotifications } = useNotificationStore()
  const { mutate: markRead } = useMarkNotificationRead()
  const { mutate: markAllRead } = useMarkAllNotificationsRead()
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my')
  const { data: myNotifications, isLoading: isLoadingMy, isError: isErrorMy } = useGetMyNotifications()
  const { data: allNotifications, isLoading: isLoadingAll, isError: isErrorAll } = useGetAllNotifications()

  // Sync fetched notifications to store based on active tab
  useEffect(() => {
    const fetchedNotifications = activeTab === 'my' ? myNotifications : allNotifications
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
  }, [activeTab, myNotifications, allNotifications, setNotifications])

  // Listen for real-time notifications
  useEffect(() => {
    if (!isConnected) return

    const unsubNotification = on('notification', () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all })
    })

    return () => {
      unsubNotification()
    }
  }, [isConnected, on, queryClient])

  const handleMarkAsRead = (id: string) => {
    markAsRead(id)
    markRead(id)
  }

  const handleMarkAllAsRead = () => {
    markAllAsRead()
    markAllRead()
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'SMS':
        return <MessageSquare size={16} />
      case 'EMAIL':
        return <Mail size={16} />
      default:
        return <Bell size={16} />
    }
  }

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'SMS':
        return 'var(--color-chart-2)'
      case 'EMAIL':
        return 'var(--color-chart-3)'
      default:
        return 'var(--color-primary)'
    }
  }

  const renderNotificationList = (isLoading: boolean, isError: boolean, items: Notification[]) => {
    if (isLoading) {
      return (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-lg border" style={{ borderColor: 'var(--color-border)' }}>
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (isError) {
      return (
        <div className="py-12 text-center" style={{ color: 'var(--color-destructive)' }}>
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">حدث خطأ</p>
          <p className="text-sm">تعذر تحميل الإشعارات. يرجى المحاولة مرة أخرى.</p>
        </div>
      )
    }

    if (items.length === 0) {
      return (
        <div className="py-12 text-center" style={{ color: 'var(--color-muted-foreground)' }}>
          <Bell size={48} className="mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium mb-1">لا توجد إشعارات</p>
          <p className="text-sm">ستظهر الإشعارات هنا عند إرسالها</p>
        </div>
      )
    }

    return (
      <div className="space-y-2">
        {items.map((notification) => (
          <div
            key={notification.id}
            className="flex items-start gap-4 p-4 rounded-lg transition-colors"
            style={{
              backgroundColor: notification.isRead ? 'transparent' : 'var(--color-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ backgroundColor: getNotificationColor(notification.type), color: '#fff' }}
            >
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium" style={{ color: 'var(--color-foreground)' }}>
                    {notification.title}
                  </p>
                  <p className="text-sm mt-1" style={{ color: 'var(--color-muted-foreground)' }}>
                    {notification.body}
                  </p>
                </div>
                {!notification.isRead && (
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                    style={{ backgroundColor: 'var(--color-primary)' }}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
                  {formatRelativeTime(notification.createdAt)}
                </span>
                <Badge variant="outline" className="text-xs">
                  {notification.type === 'PUSH' ? 'إشعار دفع' : notification.type === 'SMS' ? 'رسالة نصية' : 'بريد إلكتروني'}
                </Badge>
                {!notification.isRead && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-xs"
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    تحديد كمقروء
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="الإشعارات"
        description="إرسال وإدارة الإشعارات للمستخدمين"
        actions={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-muted-foreground)' }}>
              <Wifi size={14} style={{ color: isConnected ? 'var(--color-success)' : 'var(--color-muted-foreground)' }} />
              {isConnected ? 'متصل' : 'غير متصل'}
            </div>
            <SendNotificationModal />
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              <Bell size={20} />
            </div>
            <h3 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
              إشعارات الدفع
            </h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            إرسال إشعارات فورية للمستخدمين عبر التطبيق
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-chart-2)', color: '#fff' }}
            >
              <MessageSquare size={20} />
            </div>
            <h3 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
              رسائل نصية
            </h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            إرسال رسائل SMS للمستخدمين
          </p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: 'var(--color-chart-3)', color: '#fff' }}
            >
              <Mail size={20} />
            </div>
            <h3 className="font-semibold" style={{ color: 'var(--color-foreground)' }}>
              بريد إلكتروني
            </h3>
          </div>
          <p className="text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
            إرسال رسائل بريد إلكتروني للمستخدمين
          </p>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'my' | 'all')}>
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2
                className="text-lg font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}
              >
                الإشعارات
              </h2>
            </div>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="gap-2" onClick={handleMarkAllAsRead}>
                <CheckCheck size={16} />
                قراءة الكل
              </Button>
            )}
          </div>

          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="my">
              إشعاراتي
              {activeTab === 'my' && unreadCount > 0 && (
                <Badge variant="secondary" className="mr-2">{unreadCount}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="all">جميع الإشعارات</TabsTrigger>
          </TabsList>

          <TabsContent value="my" className="mt-0">
            {renderNotificationList(isLoadingMy, isErrorMy, myNotifications ?? [])}
          </TabsContent>

          <TabsContent value="all" className="mt-0">
            {renderNotificationList(isLoadingAll, isErrorAll, allNotifications ?? [])}
          </TabsContent>
        </Card>
      </Tabs>

      <Card className="p-6">
        <h2
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-foreground)' }}
        >
          نصائح لإرسال الإشعارات
        </h2>
        <ul className="space-y-2 text-sm" style={{ color: 'var(--color-muted-foreground)' }}>
          <li>• استخدم عناوين واضحة ومختصرة للإشعارات</li>
          <li>• تجنب إرسال إشعارات متكررة في وقت قصير</li>
          <li>• تأكد من صحة معرف المستخدم قبل الإرسال</li>
          <li>• استخدم الرسائل النصية للإشعارات الهامة فقط</li>
        </ul>
      </Card>
    </div>
  );
}
