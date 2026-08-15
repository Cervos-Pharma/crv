import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { Fe, Et } from '../lib/database'
import { fetchOperators, validateOperatorPin, createOperator, fetchBranchSubscription } from '../lib/queries'
import type { Operator } from '../types'

export default function Login() {
  const navigate = useNavigate()
  const { setOperator } = useAuth()
  const [operators, setOperators] = useState<Operator[]>([])
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false)
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminPin, setNewAdminPin] = useState('')
  const [blocked, setBlocked] = useState(false)
  const [branchId, setBranchId] = useState<string | null>(null)

  useEffect(() => {
    loadOperators()
  }, [])

  async function loadOperators() {
    const result = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
    if (result.length === 0) {
      setIsCreatingAdmin(true)
      return
    }
    const bid = JSON.parse(result[0].value)
    setBranchId(bid)
    const ops = await fetchOperators(bid)
    if (ops.length === 0) {
      setIsCreatingAdmin(true)
    } else {
      setOperators(ops)
    }
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
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    if (!newAdminName.trim() || newAdminPin.length < 4) {
      setError('Name required and PIN must be at least 4 digits')
      return
    }
    setLoading(true)
    setError('')
    try {
      let bid = branchId
      if (!bid) {
        bid = Et()
        await Fe(
          `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
          ['branch_id', JSON.stringify(bid)]
        )
      }
      const op = await createOperator({
        branch_id: bid,
        name: newAdminName.trim(),
        pin: newAdminPin,
        role: 'admin',
      })
      setOperator(op)
      navigate('/')
    } catch (err: any) {
      setError(err.message || 'Failed to create admin')
    } finally {
      setLoading(false)
    }
  }

  if (blocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-error/20 flex items-center justify-center mb-6">
            <span className="material-symbols-outlined text-[32px] text-error">block</span>
          </div>
          <h1 className="text-2xl font-display font-bold text-white mb-2">Subscription Inactive</h1>
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

  if (isCreatingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[32px] text-primary">pharmacy</span>
            </div>
            <h1 className="text-3xl font-display font-bold text-white mb-2">Cervos Pharmacy</h1>
            <p className="text-gray-400">Create your admin account to get started</p>
          </div>
          <div className="bg-surface-100 rounded-2xl border border-surface-300 p-8">
            <h2 className="text-xl font-semibold text-white mb-6">Create Admin</h2>
            {error && (
              <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Name</label>
                <input
                  type="text"
                  value={newAdminName}
                  onChange={(e) => setNewAdminName(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">PIN (at least 4 digits)</label>
                <input
                  type="password"
                  value={newAdminPin}
                  onChange={(e) => setNewAdminPin(e.target.value)}
                  required
                  minLength={4}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="----"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Admin'}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[32px] text-primary">pharmacy</span>
          </div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Cervos Pharmacy</h1>
          <p className="text-gray-400">Select your profile and enter PIN</p>
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
                      className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
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
              <p className="text-gray-400">No operators found. Contact your administrator.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
