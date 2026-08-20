import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/hooks'
import { fetchProducts, searchProducts, createProduct, deleteProduct } from '../lib/queries'
import { Product, PHARMACY_CATEGORIES, FORMULATIONS } from '../lib/types'
import StockBadge from '../components/StockBadge'
import { showToast } from '../components/ToastContainer'

export default function Catalog() {
  const { supplier } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [newProduct, setNewProduct] = useState({
    generic_name: '',
    brand_name: '',
    sku: '',
    barcode: '',
    category: '',
    formulation: '',
    requires_prescription: false,
    price: 0,
    stock_quantity: 0,
    description: '',
    low_stock_threshold: 10,
    notify_threshold: 5,
  })

  useEffect(() => {
    if (supplier) {
      loadProducts()
    }
  }, [supplier])

  const loadProducts = async () => {
    if (!supplier) return
    try {
      const data = await fetchProducts(supplier.id)
      setProducts(data)
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!supplier) return
    setLoading(true)
    try {
      if (searchQuery.trim()) {
        const data = await searchProducts(supplier.id, searchQuery)
        setProducts(data)
      } else {
        await loadProducts()
      }
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supplier) return

    try {
      const product = await createProduct({
        name: newProduct.generic_name,
        generic_name: newProduct.generic_name,
        brand_name: newProduct.brand_name,
        description: newProduct.description,
        sku: newProduct.sku,
        barcode: newProduct.barcode,
        category: newProduct.category,
        formulation: newProduct.formulation,
        requires_prescription: newProduct.requires_prescription,
        supplier_id: supplier.id,
        stock_status: newProduct.stock_quantity > (newProduct.low_stock_threshold || 10) ? 'in_stock' : newProduct.stock_quantity > 0 ? 'low_stock' : 'out_of_stock',
        low_stock_threshold: newProduct.low_stock_threshold || 10,
        notify_threshold: newProduct.notify_threshold || 5,
        currency: 'TZS',
        min_order_quantity: 1,
        specifications: {},
        tags: [],
        images: [],
        is_active: true,
      })
      setProducts([product, ...products])
      setShowAddModal(false)
      setNewProduct({ generic_name: '', brand_name: '', sku: '', barcode: '', category: '', formulation: '', requires_prescription: false, price: 0, stock_quantity: 0, description: '', low_stock_threshold: 10, notify_threshold: 5 })
      showToast('success', 'Product created successfully')
    } catch (error) {
      showToast('error', 'Failed to create product')
    }
  }

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    try {
      await deleteProduct(id)
      setProducts(products.filter((p) => p.id !== id))
      showToast('success', 'Product deleted')
    } catch (error) {
      showToast('error', 'Failed to delete product')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading catalog...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-white">Product Catalog</h2>
          <p className="text-gray-400 mt-1">{products.length} products</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors"
        >
          <span className="material-symbols-outlined text-sm">add</span>
          Add Product
        </button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search products by name, SKU, or description..."
            className="w-full pl-10 pr-4 py-3 bg-surface-100 border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-500">
            search
          </span>
        </div>
        <button
          onClick={handleSearch}
          className="px-6 py-3 bg-surface-100 border border-surface-300 rounded-lg text-white hover:bg-surface-200 transition-colors"
        >
          Search
        </button>
      </div>

      {products.length === 0 ? (
        <div className="bg-surface-100 rounded-xl border border-surface-300 p-12 text-center">
          <span className="material-symbols-outlined text-6xl text-gray-600">inventory_2</span>
          <h3 className="text-xl font-semibold text-white mt-4">No products yet</h3>
          <p className="text-gray-400 mt-2">Add your first product to get started</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-6 px-6 py-3 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors"
          >
            Add Product
          </button>
        </div>
      ) : (
        <div className="bg-surface-100 rounded-xl border border-surface-300 overflow-hidden">
          <table className="w-full">
            <thead className="bg-surface-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Product
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Formulation
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Stock
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-300">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-surface-200 transition-colors">
                  <td className="px-6 py-4">
                    <Link
                      to={`/catalog/${product.id}`}
                      className="font-medium text-white hover:text-accent transition-colors"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-gray-400 font-mono text-sm">{product.sku}</td>
                  <td className="px-6 py-4 text-gray-400">{product.category}</td>
                  <td className="px-6 py-4 text-gray-400">{product.formulation || "—"}</td>
                  <td className="px-6 py-4 text-white font-medium">TZS {product.price.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <StockBadge status={product.stock_status} />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      to={`/catalog/${product.id}`}
                      className="p-2 text-gray-400 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </Link>
                    <button
                      onClick={() => handleDeleteProduct(product.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-surface-100 rounded-2xl border border-surface-300 shadow-2xl">
            <div className="p-6 border-b border-surface-300">
              <h3 className="text-xl font-semibold text-white">Add New Product</h3>
            </div>
            <form onSubmit={handleAddProduct} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Generic Name *</label>
                <input
                  type="text"
                  required
                  value={newProduct.generic_name}
                  onChange={(e) => setNewProduct({ ...newProduct, generic_name: e.target.value })}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="e.g. Paracetamol"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Brand Name</label>
                <input
                  type="text"
                  value={newProduct.brand_name}
                  onChange={(e) => setNewProduct({ ...newProduct, brand_name: e.target.value })}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  placeholder="e.g. Panadol"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                  <select
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">Select category</option>
                    {PHARMACY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Formulation</label>
                  <select
                    value={newProduct.formulation}
                    onChange={(e) => setNewProduct({ ...newProduct, formulation: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white focus:outline-none focus:border-accent"
                  >
                    <option value="">Select formulation</option>
                    {FORMULATIONS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">SKU</label>
                  <input
                    type="text"
                    required
                    value={newProduct.sku}
                    onChange={(e) => setNewProduct({ ...newProduct, sku: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Barcode</label>
                  <input
                    type="text"
                    value={newProduct.barcode}
                    onChange={(e) => setNewProduct({ ...newProduct, barcode: e.target.value })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                    placeholder="e.g. 1234567890123"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Price (TZS)</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={newProduct.price}
                    onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Stock Qty</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newProduct.stock_quantity}
                    onChange={(e) => setNewProduct({ ...newProduct, stock_quantity: parseInt(e.target.value) })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Min Order</label>
                  <input
                    type="number"
                    min="1"
                    value={1}
                    readOnly
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Low Stock Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.low_stock_threshold}
                    onChange={(e) => setNewProduct({ ...newProduct, low_stock_threshold: parseInt(e.target.value) || 10 })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Notify Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={newProduct.notify_threshold}
                    onChange={(e) => setNewProduct({ ...newProduct, notify_threshold: parseInt(e.target.value) || 5 })}
                    className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="requires_prescription"
                  checked={newProduct.requires_prescription}
                  onChange={(e) => setNewProduct({ ...newProduct, requires_prescription: e.target.checked })}
                  className="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
                />
                <label htmlFor="requires_prescription" className="text-sm text-gray-400">Requires Prescription</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  rows={3}
                  value={newProduct.description}
                  onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                  className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2.5 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors"
                >
                  Add Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
