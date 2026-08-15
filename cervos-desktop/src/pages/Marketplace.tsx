import { useState } from 'react'
import { Fe, Et } from '../lib/database'

interface MarketplaceProduct {
  id: string
  name: string
  supplier: string
  category: string
  unit_price: number
  min_order: number
}

interface CartItem {
  product: MarketplaceProduct
  quantity: number
}

export default function Marketplace() {
  const [products] = useState<MarketplaceProduct[]>([
    { id: '1', name: 'Amoxicillin 500mg', supplier: 'PharmaCorp', category: 'Antibiotics', unit_price: 12.99, min_order: 100 },
    { id: '2', name: 'Ibuprofen 400mg', supplier: 'MediSupply', category: 'Analgesics', unit_price: 8.49, min_order: 200 },
    { id: '3', name: 'Paracetamol 500mg', supplier: 'PharmaCorp', category: 'Analgesics', unit_price: 5.99, min_order: 500 },
    { id: '4', name: 'Omeprazole 20mg', supplier: 'GastroMed', category: 'Digestive Health', unit_price: 15.99, min_order: 50 },
    { id: '5', name: 'Metformin 500mg', supplier: 'DiabeCare', category: 'Diabetes Care', unit_price: 9.99, min_order: 100 },
  ])
  const [cart, setCart] = useState<CartItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [showCart, setShowCart] = useState(false)

  const categories = [...new Set(products.map((p) => p.category))]

  const filteredProducts = products.filter((p) => {
    const matchesSearch = !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesCategory = !selectedCategory || p.category === selectedCategory
    return matchesSearch && matchesCategory
  })

  function addToCart(product: MarketplaceProduct) {
    setCart((prev) => {
      const existing = prev.find((c) => c.product.id === product.id)
      if (existing) {
        return prev.map((c) =>
          c.product.id === product.id ? { ...c, quantity: c.quantity + 1 } : c
        )
      }
      return [...prev, { product, quantity: product.min_order }]
    })
  }

  function updateQuantity(productId: string, quantity: number) {
    if (quantity < 1) return
    setCart((prev) =>
      prev.map((c) => (c.product.id === productId ? { ...c, quantity } : c))
    )
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((c) => c.product.id !== productId))
  }

  function getCartTotal(): number {
    return cart.reduce((sum, item) => sum + item.product.unit_price * item.quantity, 0)
  }

  async function placeOrder() {
    if (cart.length === 0) return
    const orderId = Et()
    await Fe(
      `INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      ['last_marketplace_order', JSON.stringify({ id: orderId, date: new Date().toISOString(), total: getCartTotal(), items: cart.length })]
    )
    setCart([])
    setShowCart(false)
    alert('Order placed successfully')
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">Marketplace</h1>
          <p className="text-sm text-on-surface-variant mt-1">Browse products from suppliers</p>
        </div>
        <button
          onClick={() => setShowCart(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white font-semibold hover:opacity-90"
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          Cart ({cart.length})
        </button>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary"
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProducts.map((product) => (
          <div key={product.id} className="bg-surface-base border border-outline-variant rounded-xl p-4">
            <div className="flex items-start justify-between mb-2">
              <div>
                <p className="font-medium text-sm">{product.name}</p>
                <p className="text-xs text-on-surface-variant">{product.supplier}</p>
              </div>
              <span className="material-symbols-outlined text-primary">medication</span>
            </div>
            <p className="text-xs text-on-surface-variant mb-2">{product.category}</p>
            <div className="flex items-center justify-between">
              <p className="font-headline text-lg font-black text-on-surface">${product.unit_price.toFixed(2)}</p>
              <button
                onClick={() => addToCart(product)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                Add
              </button>
            </div>
            <p className="text-xs text-on-surface-variant mt-1">Min order: {product.min_order}</p>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl">search</span>
          <p className="mt-2 font-medium">No products found</p>
        </div>
      )}

      {showCart && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-headline text-xl font-bold text-on-surface">Cart</h2>
              <button onClick={() => setShowCart(false)} className="p-1 rounded hover:bg-outline-variant">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {cart.length === 0 ? (
              <div className="text-center py-8 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl">shopping_cart</span>
                <p className="mt-2">Your cart is empty</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 max-h-64 overflow-auto">
                  {cart.map((item) => (
                    <div key={item.product.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{item.product.name}</p>
                        <p className="text-xs text-on-surface-variant">${item.product.unit_price.toFixed(2)} x {item.quantity}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-6 h-6 rounded-full bg-outline-variant hover:bg-primary hover:text-white flex items-center justify-center text-sm">-</button>
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-6 h-6 rounded-full bg-outline-variant hover:bg-primary hover:text-white flex items-center justify-center text-sm">+</button>
                        <button onClick={() => removeFromCart(item.product.id)} className="p-1 text-error hover:bg-error/10 rounded">
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-outline-variant mt-4 pt-4">
                  <div className="flex justify-between font-headline text-lg font-black">
                    <span>Total</span>
                    <span>${getCartTotal().toFixed(2)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    className="mt-4 w-full py-3 rounded-lg bg-primary text-white font-bold hover:opacity-90"
                  >
                    Place Order
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
