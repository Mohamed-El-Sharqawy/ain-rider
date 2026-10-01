import { describe, it, expect, beforeEach } from 'vitest'
import { useNotificationStore, type NotificationItem } from '../notificationStore'

function item(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 'n1',
    userId: 'u1',
    title: 'عنوان',
    body: 'نص',
    type: 'PUSH',
    data: null,
    isRead: false,
    createdAt: '2026-06-15T10:00:00Z',
    readAt: null,
    ...overrides,
  }
}

describe('useNotificationStore', () => {
  beforeEach(() => {
    useNotificationStore.setState({ notifications: [], unreadCount: 0 })
  })

  it('setNotifications counts unread items', () => {
    useNotificationStore.getState().setNotifications([item(), item({ id: 'n2', isRead: true })])
    const state = useNotificationStore.getState()
    expect(state.notifications).toHaveLength(2)
    expect(state.unreadCount).toBe(1)
  })

  it('addNotification prepends and increments unread only for unread items', () => {
    useNotificationStore.getState().addNotification(item())
    useNotificationStore.getState().addNotification(item({ id: 'n2', isRead: true }))
    const state = useNotificationStore.getState()
    expect(state.notifications.map((n) => n.id)).toEqual(['n2', 'n1'])
    expect(state.unreadCount).toBe(1)
  })

  it('markAsRead flags the item and decrements the counter', () => {
    useNotificationStore.getState().setNotifications([item(), item({ id: 'n2', isRead: true })])
    useNotificationStore.getState().markAsRead('n1')
    const state = useNotificationStore.getState()
    const flagged = state.notifications.find((n) => n.id === 'n1')!
    const untouched = state.notifications.find((n) => n.id === 'n2')!
    expect(flagged.isRead).toBe(true)
    expect(flagged.readAt).toBeTruthy()
    // already-read items are left exactly as they were
    expect(untouched.isRead).toBe(true)
    expect(state.unreadCount).toBe(0)
  })

  it('markAsRead never goes below zero', () => {
    useNotificationStore.getState().markAsRead('missing')
    expect(useNotificationStore.getState().unreadCount).toBe(0)
  })

  it('markAllAsRead stamps readAt only on unread items and zeroes the counter', () => {
    const readAt = '2026-06-15T11:00:00Z'
    useNotificationStore.getState().setNotifications([
      item(),
      item({ id: 'n2', isRead: true, readAt }),
    ])
    useNotificationStore.getState().markAllAsRead()
    const state = useNotificationStore.getState()
    expect(state.unreadCount).toBe(0)
    expect(state.notifications.every((n) => n.isRead)).toBe(true)
    expect(state.notifications.find((n) => n.id === 'n1')!.readAt).toBeTruthy()
    expect(state.notifications.find((n) => n.id === 'n2')!.readAt).toBe(readAt)
  })

  it('incrementUnread and setUnreadCount manage the counter directly', () => {
    useNotificationStore.getState().incrementUnread()
    expect(useNotificationStore.getState().unreadCount).toBe(1)
    useNotificationStore.getState().setUnreadCount(42)
    expect(useNotificationStore.getState().unreadCount).toBe(42)
  })
})
