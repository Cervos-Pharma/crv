import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth, useSubscription } from './lib/hooks'
import { checkSubscriptionValidity } from './lib/queries'
import Shell from './components/Shell'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Catalog from './pages/Catalog'
import Orders from './pages/Orders'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Marketplace from './pages/Marketplace'
import Payments from './pages/Payments'
import Logistics from './pages/Logistics'
import Alerts from './pages/Alerts'
import ProductDetail from './pages/ProductDetail'
import OrderDetail from './pages/OrderDetail'
import Storefront from './pages/Storefront'
import ProductInventoryDetail from './pages/ProductInventoryDetail'
import Subscription from './pages/Subscription'
import ToastContainer from './components/ToastContainer'

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

function SubscriptionGate({ children }: { children: React.ReactNode }) {
  const { subscriptionStatus } = useSubscription()
  const subscription = checkSubscriptionValidity()

  const isBlocked = !subscription.isValid && (subscriptionStatus === 'inactive' || subscriptionStatus === 'past_due')
  const currentPath = window.location.pathname
  const allowedWhenBlocked = ['/settings', '/subscription'].includes(currentPath)

  if (isBlocked && !allowedWhenBlocked) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/95 backdrop-blur-sm">
        <div className="max-w-md w-full mx-4 bg-surface-100 rounded-2xl border border-surface-300 p-8 text-center">
          <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-red-500/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-red-400">credit_card</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Subscription Required</h2>
          <p className="text-gray-400 mb-6">
            Your subscription is {subscriptionStatus === 'past_due' ? 'past due' : 'inactive'}. 
            Please update your payment method to continue using all features.
          </p>
          <a
            href="/subscription"
            className="inline-block px-6 py-3 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors"
          >
            Update Payment
          </a>
          <div className="mt-4">
            <a
              href="/settings"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Go to Settings
            </a>
          </div>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/" element={<ProtectedRoute><SubscriptionGate><Shell /></SubscriptionGate></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="catalog" element={<Catalog />} />
        <Route path="catalog/:id" element={<ProductDetail />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="marketplace" element={<Marketplace />} />
        <Route path="payments" element={<Payments />} />
        <Route path="logistics" element={<Logistics />} />
        <Route path="alerts" element={<Alerts />} />
        <Route path="storefront" element={<Storefront />} />
        <Route path="inventory/:id" element={<ProductInventoryDetail />} />
        <Route path="subscription" element={<Subscription />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
      <ToastContainer />
    </BrowserRouter>
  )
}
