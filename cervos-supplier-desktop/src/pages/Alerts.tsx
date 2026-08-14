import { useState, useEffect } from 'react'
import { useAuth } from '../lib/hooks'
import { fetchNotifications, markNotificationRead } from '../lib/queries'
import { Notification } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'

export default function Alerts() {
  const { supplier } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (supplier) {
      fetchNotifications(supplier.id)
        .then(setNotifications)
        .catch(console.error)
        .finally(() => setLoading(false))
    }
  }, [supplier])

  const handleMarkRead = async (id: string) => {
    await markNotificationRead(id)
    setNotifications(notifications.map((n) => (n.id === id ? { ...n, is_read: true } : n)))
  }

  const handleMarkAllRead = async () => {
    await Promise.all(notifications.filter((n) => !n.is_read).map((n) => markNotificationRead(n.id)))
    setNotifications(notifications.map((n) => ({ ...n, is_read: true })))
  }

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'order':
        return 'shopping_cart'
      case 'quote':
        return 'request_quote'
      case 'payment':
        return 'payments'
      case 'stock':
        return 'inventory'
      default:
        return 'info'
    }
  }

  const unreadCount = notifications.filter((n) => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Alerts</h2>
          <p className="text-gray-400 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'All caught up'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="px-4 py-2 text-sm text-accent hover:text-accent2 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-primary-400">Loading...</div>
        </div>
      ) : notifications.length === 0 ? (
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-600">notifications_none</span>
          <h3 className="text-xl font-semibold text-white mt-4">No notifications</h3>
          <p className="text-gray-400 mt-2">You're all caught up!</p>
        </div>
      ) : (
        <div className="bg-surface-100 rounded-xl border border-surface-300 divide-y divide-surface-300">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`p-6 flex gap-4 hover:bg-surface-200 transition-colors cursor-pointer ${
                !notification.is_read ? 'bg-surface-100/50' : ''
              }`}
              onClick={() => !notification.is_read && handleMarkRead(notification.id)}
            >
              <div
                className={`p-3 rounded-lg ${
                  notification.type === 'order'
                    ? 'bg-blue-500/20'
                    : notification.type === 'payment'
                    ? 'bg-green-500/20'
                    : notification.type === 'stock'
                    ? 'bg-yellow-500/20'
                    : 'bg-gray-500/20'
                }`}
              >
                <span
                  className={`material-symbols-outlined ${
                    notification.type === 'order'
                      ? 'text-blue-400'
                      : notification.type === 'payment'
                      ? 'text-green-400'
                      : notification.type === 'stock'
                      ? 'text-yellow-400'
                      : 'text-gray-400'
                  }`}
                >
                  {getIcon(notification.type)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-white">{notification.title}</h4>
                  {!notification.is_read && (
                    <span className="w-2 h-2 bg-accent rounded-full"></span>
                  )}
                </div>
                <p className="text-sm text-gray-400 mt-1">{notification.message}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
