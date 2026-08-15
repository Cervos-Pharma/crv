import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Operator } from '../types'

interface AuthState {
  currentOperator: Operator | null
  isAuthenticated: boolean
  isLoading: boolean
  setOperator: (operator: Operator | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      currentOperator: null,
      isAuthenticated: false,
      isLoading: true,
      setOperator: (operator) =>
        set({ currentOperator: operator, isAuthenticated: !!operator, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ currentOperator: null, isAuthenticated: false, isLoading: false }),
    }),
    {
      name: 'cervos-pharmacy-storage',
      partialize: (state) => ({ currentOperator: state.currentOperator, isAuthenticated: state.isAuthenticated }),
    }
  )
)

interface UIState {
  sidebarCollapsed: boolean
  notificationsOpen: boolean
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setNotificationsOpen: (open: boolean) => void
}

export const useUIStore = create<UIState>()((set) => ({
  sidebarCollapsed: false,
  notificationsOpen: false,
  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
  setNotificationsOpen: (notificationsOpen) => set({ notificationsOpen }),
}))
