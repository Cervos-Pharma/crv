import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { Fe } from '../lib/database'
import { fetchOperators, validateOperatorPin, fetchBranchSubscription } from '../lib/queries'
import type { Operator } from '../types'
import Logo from '../components/Logo'

export default function Login() {
  const navigate = useNavigate()
  const { setOperator } = useAuth()
  const [operators, setOperators] = useState<Operator[]>([])
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [branchId, setBranchId] = useState<string | null>(null)

  useEffect(() => {
    loadOperators()
  }, [])

  async function loadOperators() {
    const centreResult = await Fe("SELECT value FROM app_settings WHERE key = 'centre_name'")
    if (centreResult.length === 0) {
      navigate('/onboarding')
      return
    }

    const result = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
    if (result.length === 0) {
      navigate('/onboarding')
      return
    }
    const bid = JSON.parse(result[0].value)
    setBranchId(bid)
    const ops = await fetchOperators(bid)
    if (ops.length === 0) {
      navigate('/onboarding')
      return
    }
    setOperators(ops)
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedOperator || !branchId) return
    setLoading(true)
    setError('')
    try {
      const op = await validateOperatorPin(branchId, pin)
      if (!op) {
        setError('Invalid PIN')
        return
      }
      const sub = await fetchBranchSubscription(branchId)
      if (sub && (sub.subscription_status === 'inactive' || sub.subscription_status === 'past_due')) {
        if (sub.subscription_status === 'inactive' && sub.grace_ends_at) {
          const graceEnd = new Date(sub.grace_ends_at)
          if (new Date() > graceEnd) {
            setBlocked(true)
            return
          }
        } else {
          setBlocked(true)
          return
        }
      }
      setOperator(op)
      if (op.role === 'admin') {
        navigate('/')
      } else {
        navigate('/pos')
      }
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-6">
            <Logo size="lg" className="mx-auto" />
          </div>
          <h1 className="text-2xl font-display font-bold text-on-surface mb-2">Subscription Inactive</h1>
          <p className="text-gray-400 mb-6">
            Your subscription is inactive or past due. Please update your payment method to continue.
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined">payments</span>
            Update Payment
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4">
            <Logo size="lg" className="mx-auto" />
          </div>
          <h1 className="text-3xl font-display font-bold text-on-surface mb-2">Cervos POS</h1>
          <p className="text-on-surface-variant">Select your profile and enter PIN</p>
        </div>
        <div className="bg-surface-100 rounded-2xl border border-surface-300 p-8">
          {operators.length > 0 ? (
            <>
              <h2 className="text-xl font-semibold text-white mb-6">Sign In</h2>
              {error && (
                <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <form onSubmit={handlePinSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Operator</label>
                  <select
                    value={selectedOperator?.id || ''}
                    onChange={(e) => {
                      const op = operators.find((o) => o.id === e.target.value)
                      setSelectedOperator(op || null)
                      setPin('')
                    }}
                    required
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">Select operator</option>
                    {operators.map((op) => (
                      <option key={op.id} value={op.id}>{op.name} ({op.role})</option>
                    ))}
                  </select>
                </div>
                {selectedOperator && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">PIN</label>
                    <input
                      type="password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      required
                      maxLength={8}
                      className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-ink-deep placeholder-gray-500 focus:outline-none focus:border-primary"
                      placeholder="----"
                      autoFocus
                    />
                  </div>
                )}
                <button
                  type="submit"
                  disabled={loading || !selectedOperator}
                  className="w-full py-3 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            </>
          ) : (
            <div className="text-center">
              <p className="text-gray-400">Redirecting to onboarding...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
