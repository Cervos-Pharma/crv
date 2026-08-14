import { useEffect } from 'react'
import { useStore } from './store'
import { supabase } from './supabase'
import { Supplier } from './types'

export function useAuth() {
  const { supplier, isAuthenticated, isLoading, setSupplier, setLoading, logout } = useStore()

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
            setSupplier(profile as Supplier)
          } else {
            setSupplier(null)
          }
        } else {
          setSupplier(null)
        }
      } catch (error) {
        console.error('Session check failed:', error)
        setSupplier(null)
      } finally {
        setLoading(false)
      }
    }

    checkSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setSupplier(null)
      } else if (session?.user) {
        const { data: profile } = await supabase
          .from('suppliers')
          .select('*')
          .eq('id', session.user.id)
          .single()

        if (profile) {
          setSupplier(profile as Supplier)
        }
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [setSupplier, setLoading])

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
