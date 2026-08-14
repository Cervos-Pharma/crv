import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/hooks'
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
      <Route path="/" element={<ProtectedRoute><Shell /></ProtectedRoute>}>
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
