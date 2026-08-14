import { useState, useEffect } from 'react'

interface MarketplaceProduct {
  id: string
  name: string
  supplier: string
  price: number
  category: string
}

export default function Marketplace() {
  const [products, setProducts] = useState<MarketplaceProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setTimeout(() => {
      setProducts([
        { id: '1', name: 'Industrial Pump', supplier: 'TechFlow Inc', price: 299.99, category: 'Machinery' },
        { id: '2', name: 'LED Panel Light', supplier: 'Bright Solutions', price: 49.99, category: 'Electronics' },
        { id: '3', name: 'Safety Helmet', supplier: 'SafeGear Co', price: 24.99, category: 'Safety' },
      ])
      setLoading(false)
    }, 500)
  }, [])

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.supplier.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Marketplace</h2>
        <p className="text-gray-400 mt-1">Discover products from other suppliers</p>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search marketplace..."
          className="w-full pl-10 pr-4 py-3 bg-surface-100 border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500">
          search
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-primary-400">Loading...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {filteredProducts.map((product) => (
            <div
              key={product.id}
              className="bg-surface-100 rounded-xl border border-surface-300 p-6 hover:border-accent transition-colors"
            >
              <div className="w-12 h-12 bg-surface-300 rounded-lg flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-gray-400">inventory_2</span>
              </div>
              <h3 className="font-semibold text-white">{product.name}</h3>
              <p className="text-sm text-gray-400 mt-1">{product.supplier}</p>
              <div className="flex items-center justify-between mt-4">
                <span className="text-accent font-medium">${product.price.toFixed(2)}</span>
                <span className="text-xs text-gray-500 bg-surface px-2 py-1 rounded">{product.category}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
