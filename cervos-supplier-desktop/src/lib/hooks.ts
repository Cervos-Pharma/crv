import { useEffect, useCallback } from 'react'
import { useStore, useSubscriptionStore } from './store'
import { supabase } from './supabase'
import { Supplier } from './types'
import { syncSubscriptionStatus } from './queries'

export function useAuth() {
  const { supplier, isAuthenticated, isLoading, setSupplier, setLoading, logout } = useStore()

  const syncSubscription = useCallback(async (supplierData: Supplier | null) => {
    if (supplierData?.id) {
      try {
        await syncSubscriptionStatus(supplierData.id)
      } catch (error) {
        console.error('Failed to sync subscription:', error)
      }
    } else {
      useSubscriptionStore.getState().clearSubscription()
    }
  }, [])

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: profile } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', session.user.id)
            .single()

          if (profile) {
            const supplierData = profile as Supplier
            setSupplier(supplierData)
            await syncSubscription(supplierData)
          } else {
            setSupplier(null)
            useSubscriptionStore.getState().clearSubscription()
          }
        } else {
          setSupplier(null)
          useSubscriptionStore.getState().clearSubscription()
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setSupplier(null)
        useSubscriptionStore.getState().clearSubscription()
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setSupplier(null)
        useSubscriptionStore.getState().clearSubscription()
      } else if (session?.user) {
        const { data: profile } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          const supplierData = profile as Supplier
          setSupplier(supplierData)
          await syncSubscription(supplierData)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setSupplier, setLoading, syncSubscription])

  useEffect(() => {
    const handleOnline = async () => {
      if (supplier?.id) {
        await syncSubscription(supplier)
      }
    }

    const handleOffline = () => {
      console.log('Offline mode - using cached subscription data')
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [supplier, syncSubscription])

  return { supplier, isAuthenticated, isLoading, logout, setSupplier }
}

export function useRequireAuth() {
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      window.location.href = '/login'
    }
  }, [isAuthenticated, isLoading])
}

export function useSubscription() {
  const {
    subscriptionStatus,
    subscriptionTier,
    graceEndsAt,
    trialEndsAt,
    setSubscription,
    clearSubscription,
  } = useSubscriptionStore()

  return {
    subscriptionStatus,
    subscriptionTier,
    graceEndsAt,
    trialEndsAt,
    setSubscription,
    clearSubscription,
  }
}
