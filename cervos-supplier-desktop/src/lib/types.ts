export interface Supplier {
  id: string
  email: string
  company_name: string
  contact_name: string
  phone: string
  address: string
  city: string
  country: string
  subscription_status: 'active' | 'inactive' | 'trial' | 'past_due'
  subscription_tier: 'free' | 'starter' | 'professional' | 'enterprise'
  grace_ends_at: string | null
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface RemoteCommand {
  id: string
  type: 'product_update' | 'price_adjustment' | 'order_action' | 'notification' | 'system'
  payload: Record<string, any>
  status: 'pending' | 'acknowledged' | 'dismissed'
  created_at: string
}

export interface Product {
  id: string
  supplier_id: string
  name: string
  description: string
  sku: string
  category: string
  subcategory: string
  price: number
  currency: string
  min_order_quantity: number
  stock_quantity: number
  stock_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued'
  images: string[]
  specifications: Record<string, string>
  tags: string[]
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Order {
  id: string
  order_number: string
  supplier_id: string
  buyer_id: string
  buyer_name: string
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
  items: OrderItem[]
  subtotal: number
  shipping_cost: number
  tax: number
  total: number
  currency: string
  shipping_address: string
  tracking_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface OrderItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface Quote {
  id: string
  quote_number: string
  supplier_id: string
  buyer_id: string
  buyer_name: string
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'
  items: QuoteItem[]
  subtotal: number
  valid_until: string
  notes: string | null
  created_at: string
  updated_at: string
}

export interface QuoteItem {
  id: string
  product_id: string
  product_name: string
  quantity: number
  unit_price: number
  total: number
}

export interface Notification {
  id: string
  user_id: string
  type: 'order' | 'quote' | 'payment' | 'stock' | 'system'
  title: string
  message: string
  is_read: boolean
  reference_id: string | null
  created_at: string
}

export interface PaymentSettings {
  id: string
  supplier_id: string
  payment_methods: ('bank_transfer' | 'paypal' | 'stripe' | 'wise')[]
  bank_account_name: string
  bank_account_number: string
  bank_name: string
  bank_routing_number: string
  paypal_email: string
  stripe_account_id: string
  currency_preference: string
  updated_at: string
}

export interface AnalyticsData {
  totalQuotes: number
  totalOrders: number
  totalRevenue: number
  averageOrderValue: number
  quotesByStatus: Record<string, number>
  ordersByStatus: Record<string, number>
  revenueByMonth: { month: string; revenue: number }[]
  topProducts: { name: string; quantity: number; revenue: number }[]
}
