import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pe } from '../lib/database'
import { Nd, Z8 } from '../lib/sync'
import Logo from '../components/Logo'

type OnboardingStep = 'welcome' | 'details' | 'logo' | 'link' | 'done'

interface OnboardingProps {
  onComplete?: () => void
}

function ProgressIndicator({ current }: { current: OnboardingStep }) {
  const steps: OnboardingStep[] = ['welcome', 'details', 'logo', 'link', 'done']
  const currentIndex = steps.indexOf(current)

  return (
    <div className="flex items-center gap-1.5 mb-6">
      {steps.map((step, index) => (
        <div
          key={step}
          className={`h-1 flex-1 rounded-full transition-colors ${
            index <= currentIndex ? 'bg-primary' : 'bg-outline-variant'
          }`}
        />
      ))}
    </div>
  )
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [pharmacyName, setPharmacyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const inputClass = 'w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent'
  const labelClass = 'block text-sm font-medium text-gray-400 mb-2'

  async function handleDetailsSubmit() {
    if (!pharmacyName.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      await Pe(
        `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ['pharmacy_name', JSON.stringify(pharmacyName.trim())]
      )
      setStep('logo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLink() {
    setIsLoading(true)
    setError(null)
    try {
      await Nd(email.trim(), password)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not link account. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleDone() {
    const isLinked = await Z8()
    if (!isLinked) {
      setError('You must link your account to continue')
      setStep('link')
      return
    }
    if (onComplete) {
      onComplete()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface p-4">
      <div className="w-full max-w-md">
        <ProgressIndicator current={step} />

        <div className="bg-surface-100 rounded-2xl border border-surface-300 p-8">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4">
                <Logo size="lg" className="mx-auto" />
              </div>
              <h1 className="text-3xl font-display font-bold text-white mb-2">Cervos Pharmacy</h1>
              <p className="text-gray-400 mb-6">
                Offline-first point of sale for your pharmacy. Everything is stored locally.
              </p>
              <button
                onClick={() => setStep('details')}
                className="w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors"
              >
                Get started
              </button>
            </div>
          )}

          {step === 'details' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Your pharmacy</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Pharmacy name</label>
                  <input
                    type="text"
                    value={pharmacyName}
                    onChange={(e) => setPharmacyName(e.target.value)}
                    className={inputClass}
                    placeholder="e.g. Green Cross Pharmacy"
                  />
                </div>
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleDetailsSubmit}
                disabled={!pharmacyName.trim() || isLoading}
                className="mt-6 w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 'logo' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Store logo</h2>
              <div className="mt-6 border-2 border-dashed border-surface-300 rounded-xl p-8 text-center">
                <span className="material-symbols-outlined text-4xl text-gray-400">
                  add_photo_alternate
                </span>
                <p className="mt-2 text-sm text-gray-400">
                  Click to upload or drag and drop
                </p>
              </div>
              <button
                onClick={() => setStep('link')}
                className="mt-6 w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'link' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Link your account</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="you@pharmacy.com"
                  />
                </div>
                <div>
                  <label className={labelClass}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputClass}
                    placeholder="••••••••"
                  />
                </div>
              </div>
              {error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleLink}
                disabled={isLoading || !email.trim() || !password}
                className="mt-6 w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Linking...' : 'Link account'}
              </button>
              <p className="mt-4 text-xs text-center text-gray-400">
                Link your Supabase account to sync data across devices
              </p>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4">
                <Logo size="lg" className="mx-auto" />
              </div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">You are all set!</h2>
              <p className="text-gray-400 mb-6">
                Your pharmacy is linked and ready. Select your operator to start.
              </p>
              <button
                onClick={handleDone}
                className="w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
