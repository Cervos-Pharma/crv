import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pe } from '../lib/database'
import { Nd, Wf } from '../lib/sync'
import { invoke } from '@tauri-apps/api/core'

type OnboardingStep = 'welcome' | 'details' | 'logo' | 'location' | 'login' | 'create-pin' | 'done'

interface CentreDetails {
  name: string
  address: string
  phone: string
  email: string
}

interface LocationData {
  lat: number | null
  lng: number | null
  detected: boolean
}

interface OnboardingProps {
  onComplete?: () => void
}

async function detectLocation(): Promise<LocationData> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null, detected: false })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          detected: true
        })
      },
      () => {
        resolve({ lat: null, lng: null, detected: false })
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  })
}

async function saveCentreDetails(details: CentreDetails) {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_name', JSON.stringify(details.name.trim())]
  )
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_address', JSON.stringify(details.address.trim())]
  )
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_phone', JSON.stringify(details.phone.trim())]
  )
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_email', JSON.stringify(details.email.trim())]
  )
}

async function saveLogo(base64Data: string) {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_logo', JSON.stringify(base64Data)]
  )
}

async function saveLocation(location: LocationData) {
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_lat', JSON.stringify(location.lat)]
  )
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['centre_lng', JSON.stringify(location.lng)]
  )
  await Pe(
    `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ['location_detected', JSON.stringify(location.detected)]
  )
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [details, setDetails] = useState<CentreDetails>({ name: '', address: '', phone: '', email: '' })
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoData, setLogoData] = useState<string | null>(null)
  const [location, setLocation] = useState<LocationData>({ lat: null, lng: null, detected: false })
  const [locationLoading, setLocationLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const inputClass = 'w-full h-12 px-4 bg-surface-base border border-ink-deep/20 rounded-none text-body-md text-ink-deep focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder:text-text-muted'
  const btnClass = 'w-full h-12 bg-primary text-white rounded-none font-label-md font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all disabled:opacity-60'

  function handleLogoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const data = ev.target?.result as string
      setLogoPreview(data)
      setLogoData(data)
    }
    reader.readAsDataURL(file)
  }

  async function handleDetailsSubmit() {
    if (!details.name.trim() || !details.address.trim()) return
    setIsLoading(true)
    setError(null)
    try {
      await saveCentreDetails(details)
      setStep('logo')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save details')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLogoSubmit() {
    if (logoData) {
      try {
        await saveLogo(logoData)
      } catch (err) {
        console.error('Failed to save logo:', err)
      }
    }
    setStep('location')
  }

  async function handleDetectLocation() {
    setLocationLoading(true)
    setError(null)
    try {
      const loc = await detectLocation()
      setLocation(loc)
      await saveLocation(loc)
      if (!loc.detected) {
        setError('Could not detect location. You can continue without it.')
      }
    } catch (err) {
      setError('Location detection failed')
    } finally {
      setLocationLoading(false)
    }
  }

  async function handleLocationSubmit() {
    await saveLocation(location)
    setStep('login')
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    try {
      await Nd(email.trim(), password)
      await Wf()
      setStep('create-pin')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleCreatePin(e: React.FormEvent) {
    e.preventDefault()
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const { createOperator } = await import('../lib/queries')
      const { Fe } = await import('../lib/database')
      const { Et } = await import('../lib/database')

      const branchResult = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
      const branchId = branchResult.length > 0 ? JSON.parse(branchResult[0].value) : Et()

      await createOperator({
        branch_id: branchId,
        name: 'Admin',
        pin: pin,
        role: 'admin',
      })

      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PIN')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleOpenSignup() {
    try {
      await invoke('open', { url: 'https://cervos.online/signup' })
    } catch {
      window.open('https://cervos.online/signup', '_blank')
    }
  }

  function handleDone() {
    if (onComplete) {
      onComplete()
    } else {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <div className="fixed inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: "url('/pharmacist-1.png')", filter: "blur(10px)", transform: "scale(1.1)" }} />
      <div className="fixed inset-0 z-0 bg-surface/80" />

      <div className="fixed bottom-[-8%] left-[-8%] w-[500px] h-[500px] opacity-[0.06] pointer-events-none z-0">
        <img src="/logo.png" alt="" className="w-full h-full object-contain" style={{ mixBlendMode: "multiply" }} />
      </div>

      <header className="fixed top-0 left-0 w-full z-50 flex justify-between items-center px-8 py-5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 relative">
            <img src="/logo.png" alt="Cervos" className="w-full h-full object-contain" />
          </div>
          <span className="font-headline text-headline-md font-bold text-primary tracking-tight">Cervos</span>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center lg:justify-end lg:pr-24 p-4 relative z-10 pt-24 pb-16">
        <div className="relative w-full max-w-[460px]">
          <div className="hud-panel absolute inset-0" />
          <div className="hud-border" />
          <div className="hud-notch-line" />

          <div className="relative z-10 p-8 md:p-10">
            {step === 'welcome' && (
              <div className="text-center">
                <div className="w-20 h-20 mx-auto mb-6 relative">
                  <img src="/logo.png" alt="Cervos" className="w-full h-full object-contain" />
                </div>
                <h1 className="font-headline-lg text-headline-lg text-ink-deep mb-2">Welcome to Cervos</h1>
                <p className="font-body-md text-body-md text-on-surface-variant mb-8">
                  Set up your pharmacy centre in a few steps. Already have an account? Sign in below.
                </p>
                <button
                  onClick={() => setStep('details')}
                  className={btnClass + ' mb-4'}
                >
                  Get Started
                </button>
                <button
                  onClick={() => setStep('login')}
                  className="w-full h-12 border border-ink-deep/20 text-ink-deep font-label-md font-bold rounded-none flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all"
                >
                  Sign In
                </button>
              </div>
            )}

            {step === 'details' && (
              <form onSubmit={(e) => { e.preventDefault(); handleDetailsSubmit(); }} className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep('welcome')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <h2 className="font-headline-md text-headline-md text-ink-deep">Centre Details</h2>
                </div>

                <input
                  type="text"
                  value={details.name}
                  onChange={(e) => setDetails({ ...details, name: e.target.value })}
                  placeholder="Centre name (e.g. Green Cross Pharmacy)"
                  required
                  className={inputClass}
                />
                <input
                  type="text"
                  value={details.address}
                  onChange={(e) => setDetails({ ...details, address: e.target.value })}
                  placeholder="Address"
                  required
                  className={inputClass}
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="tel"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    placeholder="Phone"
                    className={inputClass}
                  />
                  <input
                    type="email"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    placeholder="Email"
                    className={inputClass}
                  />
                </div>

                {error && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded text-error text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={!details.name.trim() || !details.address.trim() || isLoading} className={btnClass}>
                  {isLoading ? 'Saving...' : 'Continue'}
                </button>
              </form>
            )}

            {step === 'logo' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep('details')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <h2 className="font-headline-md text-headline-md text-ink-deep">Centre Logo</h2>
                </div>

                <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">
                  Upload your pharmacy's logo. This appears on receipts.
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleLogoSelect}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-ink-deep/20 rounded p-8 text-center cursor-pointer hover:border-primary transition-colors"
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo preview" className="w-24 h-24 mx-auto object-contain" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-4xl text-on-surface-variant">add_photo_alternate</span>
                      <p className="mt-2 text-sm text-on-surface-variant">Click to upload logo</p>
                    </>
                  )}
                </div>

                <button
                  onClick={handleLogoSubmit}
                  className={btnClass}
                >
                  Continue
                </button>
                <button
                  type="button"
                  onClick={() => { setLogoPreview(null); setLogoData(null); handleLogoSubmit(); }}
                  className="text-on-surface-variant hover:text-primary text-sm"
                >
                  Skip for now
                </button>
              </div>
            )}

            {step === 'location' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep('logo')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <h2 className="font-headline-md text-headline-md text-ink-deep">Location</h2>
                </div>

                <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
                  Auto-detect your pharmacy's GPS location for delivery routing and analytics.
                </p>

                <div className="bg-surface-container rounded p-6 text-center">
                  {location.detected ? (
                    <div className="text-primary">
                      <span className="material-symbols-outlined text-4xl">check_circle</span>
                      <p className="mt-2 font-medium">Location detected</p>
                      <p className="text-sm text-on-surface-variant mt-1">
                        {location.lat?.toFixed(6)}, {location.lng?.toFixed(6)}
                      </p>
                    </div>
                  ) : locationLoading ? (
                    <div className="text-on-surface-variant">
                      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2" />
                      <p>Detecting location...</p>
                    </div>
                  ) : (
                    <div className="text-on-surface-variant">
                      <span className="material-symbols-outlined text-4xl">location_off</span>
                      <p className="mt-2">No location detected</p>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="p-3 bg-amber-100 border border-amber-200 rounded text-amber-800 text-sm">
                    {error}
                  </div>
                )}

                {!location.detected ? (
                  <button
                    onClick={handleDetectLocation}
                    disabled={locationLoading}
                    className={btnClass}
                  >
                    {locationLoading ? 'Detecting...' : 'Detect Location'}
                  </button>
                ) : (
                  <button
                    onClick={handleLocationSubmit}
                    className={btnClass}
                  >
                    Continue
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setStep('login')}
                  className="text-on-surface-variant hover:text-primary text-sm"
                >
                  Skip for now
                </button>
              </div>
            )}

            {step === 'login' && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-2 mb-2">
                  <button type="button" onClick={() => setStep('location')} className="text-on-surface-variant hover:text-primary">
                    <span className="material-symbols-outlined">arrow_back</span>
                  </button>
                  <h2 className="font-headline-md text-headline-md text-ink-deep">Sign In</h2>
                </div>

                <p className="font-body-sm text-body-sm text-on-surface-variant mb-2">
                  Link this device to your Cervos admin account to sync data across devices.
                </p>

                <form onSubmit={handleLogin} className="flex flex-col gap-3">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email"
                    required
                    className={inputClass}
                  />
                  <div className="relative">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password"
                      required
                      className={inputClass + ' pr-10'}
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-error/10 border border-error/20 rounded text-error text-sm">
                      {error}
                    </div>
                  )}

                  <button type="submit" disabled={isLoading || !email.trim() || !password} className={btnClass}>
                    {isLoading ? 'Signing in...' : 'Sign In'}
                  </button>
                </form>

                <div className="relative my-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-ink-deep/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-surface-base px-4 text-sm text-on-surface-variant">or</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleOpenSignup}
                  className="w-full h-12 border border-ink-deep/20 text-ink-deep font-label-md font-bold rounded-none flex items-center justify-center gap-2 hover:border-primary hover:text-primary transition-all"
                >
                  <span className="material-symbols-outlined text-[18px]">domain_add</span>
                  Create Account at cervos.online
                </button>

                <p className="text-center text-sm text-on-surface-variant mt-2">
                  No account needed for offline-only mode.{' '}
                  <button type="button" onClick={() => setStep('create-pin')} className="text-primary hover:underline font-semibold">
                    Skip sign in
                  </button>
                </p>
              </div>
            )}

            {step === 'create-pin' && (
              <form onSubmit={handleCreatePin} className="flex flex-col gap-4">
                <div className="text-center mb-2">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <span className="material-symbols-outlined text-[24px] text-primary">lock</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md text-ink-deep mb-1">Create Admin PIN</h2>
                  <p className="font-body-sm text-body-sm text-on-surface-variant">
                    Set a 4+ digit PIN to secure this device
                  </p>
                </div>

                <input
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 8))}
                  placeholder="Enter PIN (4+ digits)"
                  required
                  minLength={4}
                  maxLength={8}
                  className={inputClass + ' text-center text-2xl tracking-widest'}
                />

                {error && (
                  <div className="p-3 bg-error/10 border border-error/20 rounded text-error text-sm">
                    {error}
                  </div>
                )}

                <button type="submit" disabled={pin.length < 4 || isLoading} className={btnClass}>
                  {isLoading ? 'Creating...' : 'Create PIN'}
                </button>
              </form>
            )}

            {step === 'done' && (
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 bg-secondary/10 rounded-full flex items-center justify-center">
                  <span className="material-symbols-outlined text-5xl text-secondary">check_circle</span>
                </div>
                <h2 className="font-headline-md text-headline-md text-ink-deep mb-2">You're All Set!</h2>
                <p className="font-body-md text-body-md text-on-surface-variant mb-6">
                  Your centre is configured and ready to use.
                </p>

                <div className="bg-surface-container rounded p-4 text-left text-sm mb-6">
                  <h3 className="font-medium text-ink-deep mb-2">Centre Summary</h3>
                  <div className="space-y-1 text-on-surface-variant">
                    <p><span className="text-text-muted">Name:</span> {details.name}</p>
                    <p><span className="text-text-muted">Address:</span> {details.address}</p>
                    {location.detected && (
                      <p><span className="text-text-muted">Location:</span> {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}</p>
                    )}
                  </div>
                </div>

                <button onClick={handleDone} className={btnClass}>
                  Go to Dashboard
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
