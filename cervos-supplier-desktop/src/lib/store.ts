import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Supplier } from './types'

interface AuthState {
  supplier: Supplier | null
  isAuthenticated: boolean
  isLoading: boolean
  setSupplier: (supplier: Supplier | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
}

export const useStore = create<AuthState>()(
  persist(
    (set) => ({
      supplier: null,
      isAuthenticated: false,
      isLoading: true,
      setSupplier: (supplier) =>
        set({ supplier, isAuthenticated: !!supplier, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ supplier: null, isAuthenticated: false, isLoading: false }),
    }),
    {
      name: 'cervos-supplier-storage',
      partialize: (state) => ({ supplier: state.supplier, isAuthenticated: state.isAuthenticated }),
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
