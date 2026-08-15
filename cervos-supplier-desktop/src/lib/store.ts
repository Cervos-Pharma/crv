import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Supplier, RemoteCommand } from './types'

interface SubscriptionState {
  subscriptionStatus: 'active' | 'inactive' | 'trial' | 'past_due' | null
  subscriptionTier: 'free' | 'starter' | 'professional' | 'enterprise' | null
  graceEndsAt: string | null
  trialEndsAt: string | null
  setSubscription: (data: {
    subscriptionStatus: 'active' | 'inactive' | 'trial' | 'past_due'
    subscriptionTier: 'free' | 'starter' | 'professional' | 'enterprise'
    graceEndsAt?: string | null
    trialEndsAt?: string | null
  }) => void
  clearSubscription: () => void
}

export const useSubscriptionStore = create<SubscriptionState>()(
  persist(
    (set) => ({
      subscriptionStatus: null,
      subscriptionTier: null,
      graceEndsAt: null,
      trialEndsAt: null,
      setSubscription: (data) =>
        set({
          subscriptionStatus: data.subscriptionStatus,
          subscriptionTier: data.subscriptionTier,
          graceEndsAt: data.graceEndsAt ?? null,
          trialEndsAt: data.trialEndsAt ?? null,
        }),
      clearSubscription: () =>
        set({
          subscriptionStatus: null,
          subscriptionTier: null,
          graceEndsAt: null,
          trialEndsAt: null,
        }),
    }),
    {
      name: 'cervos-subscription-storage',
    }
  )
)

interface RemoteCommandsState {
  pendingCommands: RemoteCommand[]
  setPendingCommands: (commands: RemoteCommand[]) => void
  addCommand: (command: RemoteCommand) => void
  removeCommand: (commandId: string) => void
  clearCommands: () => void
}

export const useRemoteCommandsStore = create<RemoteCommandsState>()(
  persist(
    (set) => ({
      pendingCommands: [],
      setPendingCommands: (commands) => set({ pendingCommands: commands }),
      addCommand: (command) =>
        set((state) => ({
          pendingCommands: [...state.pendingCommands, command],
        })),
      removeCommand: (commandId) =>
        set((state) => ({
          pendingCommands: state.pendingCommands.filter((c) => c.id !== commandId),
        })),
      clearCommands: () => set({ pendingCommands: [] }),
    }),
    {
      name: 'cervos-remote-commands-storage',
    }
  )
)

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
