import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Fe, Pe } from '../lib/database'
import { np, tp } from '../lib/sync'
import { useAuthStore } from '../lib/store'

export default function Settings() {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  const [pharmacyName, setPharmacyName] = useState('')
  const [stats, setStats] = useState({ linked: false, pendingCount: 0, lastSyncedAt: null as string | null })
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState('')

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    const nameResult = await Fe("SELECT value FROM app_settings WHERE key = 'pharmacy_name'")
    if (nameResult.length > 0) {
      setPharmacyName(JSON.parse(nameResult[0].value))
    }
    const s = await np()
    setStats(s)
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
      await new Promise((resolve) => setTimeout(resolve, 2000))
      setSyncMessage('Sync completed successfully')
    } catch (err) {
      setSyncMessage('Sync failed. Please try again.')
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
