import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Fe, Pe } from '../lib/database'
import { np, tp } from '../lib/sync'
import { useAuthStore } from '../lib/store'
import { fetchOperators, createOperator, deleteOperator } from '../lib/queries'
import { supabaseUrl } from '../lib/supabase'
import type { Operator } from '../types'

export default function Settings() {
  const navigate = useNavigate()
  const { logout, currentOperator, isAdmin } = useAuthStore()
  const [pharmacyName, setPharmacyName] = useState('')
  const [stats, setStats] = useState({ linked: false, pendingCount: 0, lastSyncedAt: null as string | null })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')
  const [operators, setOperators] = useState<Operator[]>([])
  const [showAddOperator, setShowAddOperator] = useState(false)
  const [newOpName, setNewOpName] = useState('')
  const [newOpPin, setNewOpPin] = useState('')
  const [newOpRole, setNewOpRole] = useState<'admin' | 'operator'>('operator')
  const [branchId, setBranchId] = useState<string | null>(null)

  useEffect(() => {
    loadSettings()
  }, [])

  useEffect(() => {
    if (isAdmin) {
      loadOperators()
    }
  }, [isAdmin])

  async function loadSettings() {
    const nameResult = await Fe("SELECT value FROM app_settings WHERE key = 'pharmacy_name'")
    if (nameResult.length > 0) {
      setPharmacyName(JSON.parse(nameResult[0].value))
    }
    const branchResult = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
    if (branchResult.length > 0) {
      setBranchId(JSON.parse(branchResult[0].value))
    }
    const s = await np()
    setStats(s)
  }

  async function loadOperators() {
    if (!branchId) return
    const ops = await fetchOperators(branchId)
    setOperators(ops)
  }

  async function handleAddOperator(e: React.FormEvent) {
    e.preventDefault()
    if (!branchId || !newOpName.trim() || newOpPin.length < 4) return
    try {
      await createOperator({
        branch_id: branchId,
        name: newOpName.trim(),
        pin: newOpPin,
        role: newOpRole,
      })
      setNewOpName('')
      setNewOpPin('')
      setNewOpRole('operator')
      setShowAddOperator(false)
      loadOperators()
    } catch (err: any) {
      console.error('Failed to create operator:', err)
    }
  }

  async function handleDeleteOperator(id: string) {
    if (id === currentOperator?.id) return
    if (!confirm('Delete this operator?')) return
    await deleteOperator(id)
    loadOperators()
  }

  async function handleSaveName() {
    await Pe(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['pharmacy_name', JSON.stringify(pharmacyName)]
    )
  }

  async function handleSync() {
    setIsSyncing(true)
    setSyncMessage('')
    try {
      const sync = await import('../lib/sync')
      const supabase = sync.getSupabase()
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        setSyncMessage('Not linked to server.')
        return
      }
      const branchResult = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
      if (!branchResult.length) { setSyncMessage('No branch set.'); return }
      const branchId = JSON.parse(branchResult[0].value)

      const accountIdResult = await Fe("SELECT value FROM app_settings WHERE key = 'account_id'")
      const accountId = accountIdResult.length > 0 ? JSON.parse(accountIdResult[0].value) : null
      if (!accountId) { setSyncMessage('No account ID found.'); return }

      const lastPull = await sync.q0(branchId)
      const since = lastPull || '1970-01-01T00:00:00Z'

      const res = await fetch(`${supabaseUrl}/api/sync?since=${encodeURIComponent(since)}`, {
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          'x-account-id': accountId
        }
      })
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`)
      const data = await res.json()

      await sync.syncSubscription(branchId)

      const now = new Date().toISOString()
      await sync.K0(branchId, now)
      await sync.Xd('last_synced_at', now)

      const s = await sync.np()
      setStats(s)
      setSyncMessage(`Synced ${data.records ?? 0} records at ${new Date().toLocaleTimeString()}`)
    } catch (err: any) {
      setSyncMessage(`Sync failed: ${err.message}`)
    } finally {
      setIsSyncing(false)
    }
  }

  async function handleUnlink() {
    await tp()
    setStats({ ...stats, linked: false })
  }

  async function handleSignOut() {
    logout()
    await tp()
    navigate('/login')
  }

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="font-headline text-2xl font-black text-on-surface mb-6">
        Settings
      </h1>

      <div className="space-y-6">
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
            Store Information
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-on-surface-variant mb-1">
                Pharmacy Name
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={pharmacyName}
                  onChange={(e) => setPharmacyName(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  placeholder="Enter pharmacy name"
                />
                <button
                  onClick={handleSaveName}
                  className="px-4 py-2.5 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>

        {isAdmin && (
          <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-headline text-lg font-bold text-on-surface">
                Team Management
              </h2>
              <button
                onClick={() => setShowAddOperator(true)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add Operator
              </button>
            </div>

            {showAddOperator && (
              <form onSubmit={handleAddOperator} className="mb-4 p-4 bg-surface border border-outline rounded-lg space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Name</label>
                    <input
                      type="text"
                      value={newOpName}
                      onChange={(e) => setNewOpName(e.target.value)}
                      required
                      className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm"
                      placeholder="Operator name"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">PIN (4+ digits)</label>
                    <input
                      type="password"
                      value={newOpPin}
                      onChange={(e) => setNewOpPin(e.target.value)}
                      required
                      minLength={4}
                      className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm"
                      placeholder="----"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-on-surface-variant mb-1">Role</label>
                    <select
                      value={newOpRole}
                      onChange={(e) => setNewOpRole(e.target.value as 'admin' | 'operator')}
                      className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm"
                    >
                      <option value="operator">Operator</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-md bg-primary text-white text-sm font-semibold hover:opacity-90"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddOperator(false)}
                    className="px-4 py-2 rounded-md border border-outline-variant text-sm hover:bg-outline-variant/30"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-2">
              {operators.map((op) => (
                <div key={op.id} className="flex items-center justify-between p-3 bg-surface rounded-lg border border-outline-variant">
                  <div>
                    <p className="font-medium text-sm">{op.name}</p>
                    <p className="text-xs text-on-surface-variant capitalize">{op.role}</p>
                  </div>
                  {op.id !== currentOperator?.id && (
                    <button
                      onClick={() => handleDeleteOperator(op.id)}
                      className="p-1.5 rounded hover:bg-error/10 text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
            Cloud Sync
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Connection Status</p>
                <p className="text-xs text-on-surface-variant">
                  {stats.linked ? 'Connected to Supabase' : 'Not linked - offline only'}
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                  stats.linked
                    ? 'bg-secondary/10 text-secondary'
                    : 'bg-outline-variant text-on-surface-variant'
                }`}
              >
                {stats.linked ? 'Linked' : 'Offline'}
              </span>
            </div>

            {stats.linked && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">Pending Changes</p>
                    <p className="text-xs text-on-surface-variant">
                      {stats.pendingCount} changes waiting to sync
                    </p>
                  </div>
                  <span className="font-semibold">{stats.pendingCount}</span>
                </div>

                {stats.lastSyncedAt && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">Last Synced</p>
                      <p className="text-xs text-on-surface-variant">
                        {new Date(stats.lastSyncedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md bg-primary text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {isSyncing ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-xl">
                          progress_activity
                        </span>
                        Syncing...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">sync</span>
                        Sync Now
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleUnlink}
                    className="px-4 py-2.5 rounded-md border border-error text-error font-semibold hover:bg-error/10 transition-colors"
                  >
                    Unlink
                  </button>
                </div>

                {syncMessage && (
                  <p
                    className={`text-sm ${
                      syncMessage.includes('failed') ? 'text-error' : 'text-secondary'
                    }`}
                  >
                    {syncMessage}
                  </p>
                )}
              </>
            )}

            {!stats.linked && (
              <div className="pt-2">
                <Link
                  to="/onboarding"
                  className="flex items-center justify-center gap-2 py-2.5 rounded-md border border-outline-variant text-on-surface font-medium hover:bg-outline-variant/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">link</span>
                  Link your account
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
            Data Management
          </h2>

          <div className="space-y-3">
            <button
              onClick={async () => {
                if (confirm('Export all data as JSON?')) {
                  const data = {
                    products: await Fe('SELECT * FROM products'),
                    batches: await Fe('SELECT * FROM batches'),
                    sales: await Fe('SELECT * FROM sales'),
                    operators: await Fe('SELECT * FROM operators'),
                    settings: await Fe('SELECT * FROM app_settings'),
                  }
                  const blob = new Blob([JSON.stringify(data, null, 2)], {
                    type: 'application/json',
                  })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `cervos-export-${new Date().toISOString().slice(0, 10)}.json`
                  a.click()
                  URL.revokeObjectURL(url)
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-outline-variant hover:bg-outline-variant/30 transition-colors"
            >
              <span className="material-symbols-outlined text-xl text-primary">
                download
              </span>
              <span className="font-medium">Export Data</span>
            </button>

            <button
              onClick={() => {
                if (
                  confirm(
                    'This will clear all local data. This action cannot be undone. Continue?'
                  )
                ) {
                  localStorage.clear()
                  window.location.reload()
                }
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-error text-error hover:bg-error/10 transition-colors"
            >
              <span className="material-symbols-outlined text-xl">delete_forever</span>
              <span className="font-medium">Clear All Data</span>
            </button>
          </div>
        </div>

        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
            Account
          </h2>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-error text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            <span className="font-medium">Sign Out</span>
          </button>
        </div>

        <div className="text-center text-xs text-on-surface-variant">
          <p>Cervos Pharmacy OS v0.1.0</p>
          <p className="mt-1">Built with Tauri 2 + React</p>
        </div>
      </div>
    </div>
  )
}
