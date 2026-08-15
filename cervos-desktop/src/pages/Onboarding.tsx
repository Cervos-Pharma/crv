import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Pe } from '../lib/database'
import { Nd, Z8, Wf } from '../lib/sync'

type OnboardingStep = 'welcome' | 'details' | 'logo' | 'location' | 'link' | 'done'

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

function ProgressIndicator({ current }: { current: OnboardingStep }) {
  const steps: OnboardingStep[] = ['welcome', 'details', 'logo', 'location', 'link', 'done']
  const labels = ['Welcome', 'Centre', 'Logo', 'Location', 'Link', 'Done']
  const currentIndex = steps.indexOf(current)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        {labels.map((label, index) => (
          <div
            key={index}
            className={`flex flex-col items-center ${index <= currentIndex ? 'text-accent' : 'text-gray-500'}`}
          >
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                index < currentIndex ? 'bg-accent text-white' :
                index === currentIndex ? 'bg-accent text-white' :
                'bg-surface-300 text-gray-400'
              }`}
            >
              {index < currentIndex ? '✓' : index + 1}
            </div>
            <span className="text-xs mt-1 hidden sm:block">{label}</span>
          </div>
        ))}
      </div>
      <div className="h-1 bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent transition-all duration-300"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  )
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
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const inputClass = 'w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent'
  const labelClass = 'block text-sm font-medium text-gray-400 mb-2'

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
    setStep('link')
  }

  async function handleLink() {
    setIsLoading(true)
    setError(null)
    try {
      await Nd(email.trim(), password)
      await Wf()
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
      <div className="w-full max-w-lg">
        <ProgressIndicator current={step} />

        <div className="bg-surface-100 rounded-2xl border border-surface-300 p-8">
          {step === 'welcome' && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-accent/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-accent">local_pharmacy</span>
              </div>
              <h1 className="text-2xl font-display font-bold text-white mb-2">Welcome to Cervos Pharmacy</h1>
              <p className="text-gray-400 mb-6">
                Let's set up your pharmacy centre. We'll need some details about your location and an admin account to link with.
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
              <h2 className="text-xl font-semibold text-white mb-6">Centre Details</h2>
              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Centre name *</label>
                  <input
                    type="text"
                    value={details.name}
                    onChange={(e) => setDetails({ ...details, name: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. Green Cross Pharmacy"
                  />
                </div>
                <div>
                  <label className={labelClass}>Address *</label>
                  <input
                    type="text"
                    value={details.address}
                    onChange={(e) => setDetails({ ...details, address: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. 123 Main Street, Nairobi"
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone number</label>
                  <input
                    type="tel"
                    value={details.phone}
                    onChange={(e) => setDetails({ ...details, phone: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. +254 700 123456"
                  />
                </div>
                <div>
                  <label className={labelClass}>Email address</label>
                  <input
                    type="email"
                    value={details.email}
                    onChange={(e) => setDetails({ ...details, email: e.target.value })}
                    className={inputClass}
                    placeholder="e.g. info@pharmacyname.com"
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
                disabled={!details.name.trim() || !details.address.trim() || isLoading}
                className="mt-6 w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {step === 'logo' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Centre Logo</h2>
              <p className="text-gray-400 text-sm mb-4">Upload your pharmacy's logo. This will appear on receipts and receipts.</p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                className="hidden"
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-surface-300 rounded-xl p-8 text-center cursor-pointer hover:border-accent transition-colors"
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo preview" className="w-24 h-24 mx-auto object-contain" />
                ) : (
                  <>
                    <span className="material-symbols-outlined text-4xl text-gray-400">add_photo_alternate</span>
                    <p className="mt-2 text-sm text-gray-400">Click to upload logo</p>
                  </>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => { setLogoPreview(null); setLogoData(null); }}
                  className="flex-1 py-3 rounded-lg bg-surface-300 text-white font-medium hover:bg-surface-400 transition-colors"
                >
                  Skip
                </button>
                <button
                  onClick={handleLogoSubmit}
                  className="flex-1 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 'location' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Location</h2>
              <p className="text-gray-400 text-sm mb-4">Auto-detect your pharmacy's GPS location for delivery routing and analytics.</p>

              <div className="bg-surface rounded-xl p-6 text-center">
                {location.detected ? (
                  <div className="text-accent">
                    <span className="material-symbols-outlined text-4xl">check_circle</span>
                    <p className="mt-2 font-medium">Location detected</p>
                    <p className="text-sm text-gray-400 mt-1">
                      {location.lat?.toFixed(6)}, {location.lng?.toFixed(6)}
                    </p>
                  </div>
                ) : locationLoading ? (
                  <div className="text-gray-400">
                    <span className="material-symbols-outlined text-4xl animate-spin">progress_activity</span>
                    <p className="mt-2">Detecting location...</p>
                  </div>
                ) : (
                  <div className="text-gray-400">
                    <span className="material-symbols-outlined text-4xl">location_off</span>
                    <p className="mt-2">No location detected</p>
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setStep('link')}
                  className="flex-1 py-3 rounded-lg bg-surface-300 text-white font-medium hover:bg-surface-400 transition-colors"
                >
                  Skip
                </button>
                {!location.detected ? (
                  <button
                    onClick={handleDetectLocation}
                    disabled={locationLoading}
                    className="flex-1 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors disabled:opacity-50"
                  >
                    {locationLoading ? 'Detecting...' : 'Detect Location'}
                  </button>
                ) : (
                  <button
                    onClick={handleLocationSubmit}
                    className="flex-1 py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors"
                  >
                    Continue
                  </button>
                )}
              </div>
            </div>
          )}

          {step === 'link' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-6">Link to Admin</h2>
              <p className="text-gray-400 text-sm mb-4">
                Connect to your online Cervos admin account. This will register your branch and enable cloud sync.
              </p>

              <div className="space-y-4">
                <div>
                  <label className={labelClass}>Admin email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="admin@yourpharmacy.com"
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

              <div className="mt-6 p-4 bg-surface rounded-lg text-sm text-gray-400">
                <p className="font-medium text-white mb-1">What happens next:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Your centre details are registered with the admin</li>
                  <li>A branch is created for your pharmacy</li>
                  <li>Data sync between devices is enabled</li>
                </ul>
              </div>

              <button
                onClick={handleLink}
                disabled={isLoading || !email.trim() || !password}
                className="mt-6 w-full py-3 rounded-lg bg-accent text-white font-medium hover:bg-accent2 transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Linking...' : 'Link Account'}
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 bg-green-500/10 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-5xl text-green-500">check_circle</span>
              </div>
              <h2 className="text-2xl font-display font-bold text-white mb-2">You're all set!</h2>
              <p className="text-gray-400 mb-6">
                Your centre is registered and linked. You can now start using Cervos Pharmacy OS.
              </p>

              <div className="bg-surface rounded-lg p-4 text-left text-sm mb-6">
                <h3 className="font-medium text-white mb-2">Centre Summary</h3>
                <div className="space-y-1 text-gray-400">
                  <p><span className="text-gray-500">Name:</span> {details.name}</p>
                  <p><span className="text-gray-500">Address:</span> {details.address}</p>
                  {location.detected && (
                    <p><span className="text-gray-500">Location:</span> {location.lat?.toFixed(4)}, {location.lng?.toFixed(4)}</p>
                  )}
                </div>
              </div>

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
