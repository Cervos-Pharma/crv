import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from './lib/hooks'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Pos from './pages/Pos'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import Reports from './pages/Reports'
import Users from './pages/Users'
import Marketplace from './pages/Marketplace'
import Subscription from './pages/Subscription'
import Onboarding from './pages/Onboarding'
import { initDb } from './lib/database'
import { Fe } from './lib/database'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { currentOperator, isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (currentOperator?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function OnboardingRoute() {
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const check = async () => {
      const result = await Fe("SELECT value FROM app_settings WHERE key = 'pharmacy_name'")
      setIsOnboarded(result.length > 0)
    }
    check()
  }, [])

  if (isOnboarded === null) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  if (isOnboarded) {
    return <Navigate to="/login" replace />
  }

  return <Onboarding onComplete={() => navigate('/login')} />
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()
  const [dbReady, setDbReady] = useState(false)

  useEffect(() => {
    initDb()
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error("Database init failed:", err);
        setDbReady(true);
      });
  }, [])

  if (!dbReady || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/onboarding" element={<OnboardingRoute />} />
      <Route path="/" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="pos" element={<Pos />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="settings" element={<Settings />} />
        <Route path="reports" element={<AdminRoute><Reports /></AdminRoute>} />
        <Route path="users" element={<AdminRoute><Users /></AdminRoute>} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
