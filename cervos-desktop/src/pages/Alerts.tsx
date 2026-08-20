import { useState, useEffect } from 'react'
import { queryDb } from '../lib/database'
import { useAuthStore } from '../lib/store'

interface SubscriptionInfo {
  status: string
  grace_ends_at: string | null
  trial_ends_at: string | null
}

export default function Alerts() {
  const { isAdmin, isAuthenticated } = useAuthStore()
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null)
  const [showBanner, setShowBanner] = useState(false)
  const [bannerMessage, setBannerMessage] = useState('')

  useEffect(() => {
    loadSubscription()
  }, [])

  async function loadSubscription() {
    const statusResult = await queryDb("SELECT value FROM app_settings WHERE key = 'subscription_status'")
    const graceResult = await queryDb("SELECT value FROM app_settings WHERE key = 'grace_ends_at'")
    const trialResult = await queryDb("SELECT value FROM app_settings WHERE key = 'trial_ends_at'")

    const status = statusResult.length > 0 ? JSON.parse(statusResult[0].value) : 'trial'
    const graceEndsAt = graceResult.length > 0 ? JSON.parse(graceResult[0].value) : null
    const trialEndsAt = trialResult.length > 0 ? JSON.parse(trialResult[0].value) : null

    setSubscription({ status, grace_ends_at: graceEndsAt, trial_ends_at: trialEndsAt })
    checkWarning(status, graceEndsAt, trialEndsAt)
  }

  function checkWarning(status: string, graceEndsAt: string | null, trialEndsAt: string | null) {
    const now = new Date()
    const THREE_DAYS = 3 * 24 * 60 * 60 * 1000

    if (status === 'grace' && graceEndsAt) {
      const graceEnd = new Date(graceEndsAt)
      const daysLeft = graceEnd.getTime() - now.getTime()
      if (daysLeft <= THREE_DAYS && daysLeft > 0) {
        setShowBanner(true)
        setBannerMessage(`Your account is at risk of being locked. Contact your administrator to renew the subscription. (${Math.ceil(daysLeft / (24 * 60 * 60 * 1000))} days remaining)`)
      }
    }

    if (status === 'trial' && trialEndsAt) {
      const trialEnd = new Date(trialEndsAt)
      const daysLeft = trialEnd.getTime() - now.getTime()
      if (daysLeft <= THREE_DAYS && daysLeft > 0) {
        setShowBanner(true)
        setBannerMessage(`Your trial ends in ${Math.ceil(daysLeft / (24 * 60 * 60 * 1000))} days. Contact your administrator to subscribe.`)
      }
    }
  }

  if (!isAuthenticated) return null

  return (
    <div className="p-6">
      <h1 className="font-headline text-2xl font-black text-on-surface mb-6">
        Alerts
      </h1>

      {showBanner && !isAdmin && (
        <div className="mb-6 p-4 bg-error/10 border border-error/30 rounded-xl flex items-start gap-3">
          <span className="material-symbols-outlined text-error text-xl">warning</span>
          <div>
            <p className="font-semibold text-error">Account at Risk</p>
            <p className="text-sm text-on-surface mt-1">{bannerMessage}</p>
          </div>
        </div>
      )}

      {isAdmin && subscription && (
        <div className="bg-surface-base border border-outline-variant rounded-xl p-5">
          <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
            Subscription Status
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-on-surface-variant">Status</span>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                subscription.status === 'active' ? 'bg-secondary/10 text-secondary' :
                subscription.status === 'trial' ? 'bg-blue-500/10 text-blue-400' :
                subscription.status === 'grace' ? 'bg-amber-500/10 text-amber-400' :
                'bg-error/10 text-error'
              }`}>
                {subscription.status.toUpperCase()}
              </span>
            </div>
            {subscription.trial_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Trial Ends</span>
                <span className="text-sm font-medium">{new Date(subscription.trial_ends_at).toLocaleDateString()}</span>
              </div>
            )}
            {subscription.grace_ends_at && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-on-surface-variant">Grace Period Ends</span>
                <span className="text-sm font-medium">{new Date(subscription.grace_ends_at).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {!showBanner && isAdmin && (
        <div className="mt-6 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl">check_circle</span>
          <p className="mt-2 font-medium">No active alerts</p>
          <p className="text-sm">Your subscription is in good standing</p>
        </div>
      )}

      {!showBanner && !isAdmin && (
        <div className="mt-6 text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl">notifications_off</span>
          <p className="mt-2 font-medium">No alerts</p>
          <p className="text-sm">You're all caught up</p>
        </div>
      )}
    </div>
  )
}