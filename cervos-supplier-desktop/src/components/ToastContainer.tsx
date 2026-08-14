import { useState, useEffect } from 'react'

interface Toast {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
}

let toastId = 0
const toastListeners: ((toasts: Toast[]) => void)[] = []
let toasts: Toast[] = []

export function showToast(type: Toast['type'], message: string) {
  const toast: Toast = { id: String(++toastId), type, message }
  toasts = [...toasts, toast]
  toastListeners.forEach((listener) => listener(toasts))

  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== toast.id)
    toastListeners.forEach((listener) => listener(toasts))
  }, 4000)
}

export default function ToastContainer() {
  const [currentToasts, setCurrentToasts] = useState<Toast[]>([])

  useEffect(() => {
    toastListeners.push(setCurrentToasts)
    return () => {
      toastListeners.splice(toastListeners.indexOf(setCurrentToasts), 1)
    }
  }, [])

  const getIcon = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'check_circle'
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'info'
    }
  }

  const getColor = (type: Toast['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400'
      case 'error':
        return 'bg-red-500/20 border-red-500/50 text-red-400'
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400'
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400'
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {currentToasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg ${getColor(toast.type)}`}
        >
          <span className="material-symbols-outlined text-lg">{getIcon(toast.type)}</span>
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  )
}
