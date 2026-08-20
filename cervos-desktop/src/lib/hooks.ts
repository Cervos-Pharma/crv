import { useEffect } from 'react'
import { useAuthStore } from './store'
import { fetchOperator } from './queries'
import type { Operator } from '../types'

export function useAuth() {
  const { currentOperator, isAuthenticated, isLoading, isAdmin, permissions, setOperator, setLoading, logout } = useAuthStore()

  useEffect(() => {
    const checkSession = async () => {
      if (!useAuthStore.getState()._hasHydrated) {
        return
      }
      try {
        const stored = useAuthStore.getState()
        if (stored.currentOperator?.id) {
          const operator = await fetchOperator(stored.currentOperator.id)
          if (operator) {
            setOperator(operator as Operator)
          } else {
            setOperator(null)
          }
        } else {
          setOperator(null)
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setOperator(null)
      } finally {
        setLoading(false)
      }
    }

    checkSession()
  }, [setOperator, setLoading])

  return { currentOperator, isAuthenticated, isLoading, isAdmin, permissions, logout, setOperator }
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [isAuthenticated, isLoading])
}

export function usePermissions() {
  const { isAdmin, permissions, currentOperator } = useAuthStore()
  return { isAdmin, permissions, role: currentOperator?.role }
}
