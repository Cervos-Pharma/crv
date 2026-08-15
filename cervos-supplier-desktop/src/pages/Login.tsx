import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/hooks'
import { Supplier } from '../lib/types'
import { syncSubscriptionStatus } from '../lib/queries'

export default function Login() {
  const navigate = useNavigate()
  const { setSupplier } = useAuth()
  const [isSignUp, setIsSignUp] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (isSignUp) {
        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        })

        if (signUpError) throw signUpError

        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from('suppliers')
            .insert({
              id: authData.user.id,
              email,
              company_name: '',
              contact_name: '',
              phone: '',
              address: '',
              city: '',
              country: '',
              subscription_status: 'trial',
              subscription_tier: 'free',
              grace_ends_at: null,
              trial_ends_at: null,
            })
            .select()
            .single()

          if (profileError) throw profileError
          const supplierData = profile as Supplier
          setSupplier(supplierData)
          await syncSubscriptionStatus(supplierData.id)
          navigate('/')
        }
      } else {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (signInError) throw signInError

        if (authData.user) {
          const { data: profile, error: profileError } = await supabase
            .from('suppliers')
            .select('*')
            .eq('id', authData.user.id)
            .single()

          if (profileError) throw profileError

          if (profile.subscription_status === 'inactive' || profile.subscription_status === 'past_due') {
            setError('Your subscription is inactive. Please update your payment method.')
          }

          const supplierData = profile as Supplier
          setSupplier(supplierData)
          await syncSubscriptionStatus(supplierData.id)
          navigate('/')
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-display font-bold text-white mb-2">Cervos</h1>
          <p className="text-gray-400">Supplier Portal</p>
        </div>

        <div className="bg-surface-100 rounded-2xl border border-surface-300 p-8">
          <h2 className="text-xl font-semibold text-white mb-6">
            {isSignUp ? 'Create Account' : 'Sign In'}
          </h2>

          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Processing...' : isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
