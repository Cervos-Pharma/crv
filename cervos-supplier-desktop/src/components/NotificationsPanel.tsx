import { useEffect, useState } from 'react'
import { useAuth } from '../lib/hooks'
import { fetchNotifications, markNotificationRead } from '../lib/queries'
import { Notification } from '../lib/types'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  onClose: () => void
}

export default function NotificationsPanel({ onClose }: Props) {
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
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    )
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-96 h-full bg-surface-100 border-l border-surface-300 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-surface-300">
          <h2 className="text-lg font-semibold text-white">Notifications</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-surface-300 transition-colors"
          >
            <span className="material-symbols-outlined text-gray-400">close</span>
          </button>
        </div>

        <div className="overflow-y-auto h-[calc(100%-4rem)]">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading...</div>
          ) : notifications.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No notifications</div>
          ) : (
            <div className="divide-y divide-surface-300">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-surface-200 transition-colors ${
                    !notification.is_read ? 'bg-surface-200/50' : ''
                  }`}
                  onClick={() => !notification.is_read && handleMarkRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <span className="material-symbols-outlined text-gray-500">
                      {getIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{notification.title}</p>
                      <p className="text-sm text-gray-400 mt-0.5">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                        })}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-accent rounded-full mt-2"></span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
