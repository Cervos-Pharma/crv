import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { fetchProduct, updateProduct } from '../lib/queries'
import { Product, PHARMACY_CATEGORIES, FORMULATIONS } from '../lib/types'
import StockBadge from '../components/StockBadge'
import { showToast } from '../components/ToastContainer'

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    generic_name: '',
    brand_name: '',
    description: '',
    sku: '',
    barcode: '',
    category: '',
    formulation: '',
    requires_prescription: false,
    price: 0,
    stock_quantity: 0,
    low_stock_threshold: 10,
    notify_threshold: 5,
  })

  useEffect(() => {
    if (id) {
      loadProduct()
    }
  }, [id])

  const loadProduct = async () => {
    if (!id) return
    try {
      const data = await fetchProduct(id)
      if (data) {
        setProduct(data)
        setFormData({
          generic_name: data.generic_name || data.name || '',
          brand_name: data.brand_name || '',
          description: data.description,
          sku: data.sku,
          barcode: data.barcode || '',
          category: data.category,
          formulation: data.formulation || '',
          requires_prescription: data.requires_prescription || false,
          price: data.price,
          stock_quantity: data.stock_quantity,
          low_stock_threshold: data.low_stock_threshold || 10,
          notify_threshold: data.notify_threshold || 5,
        })
      }
    } catch (error) {
      console.error('Failed to load product:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked
    setFormData({ ...formData, [name]: type === 'checkbox' ? checked : type === 'number' ? parseFloat(value) || 0 : value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return

    setSaving(true)
    try {
      const updated = await updateProduct(id, {
        ...formData,
        stock_status: formData.stock_quantity > (formData.low_stock_threshold || 10) ? 'in_stock' : formData.stock_quantity > 0 ? 'low_stock' : 'out_of_stock',
      })
      setProduct(updated)
      showToast('success', 'Product updated successfully')
    } catch (error) {
      showToast('error', 'Failed to update product')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-primary-400">Loading...</div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Product not found</p>
        <button onClick={() => navigate('/catalog')} className="mt-4 text-accent hover:text-accent2">
          Back to Catalog
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/catalog')} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
          <span className="material-symbols-outlined text-sm">arrow_back</span>
          Back to Catalog
        </button>
        <StockBadge status={product.stock_status} />
      </div>

      <div className="bg-surface-100 rounded-xl border border-surface-300 p-6">
        <h2 className="text-xl font-semibold text-white mb-6">Edit Product</h2>
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Generic Name</label>
            <input
              type="text"
              name="generic_name"
              value={formData.generic_name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">Brand Name</label>
            <input
              type="text"
              name="brand_name"
              value={formData.brand_name}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
              <select
                name="category"
                value={formData.category}
                onChange={handleChange as any}
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
                name="formulation"
                value={formData.formulation}
                onChange={handleChange as any}
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
                name="sku"
                value={formData.sku}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Barcode</label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Price (TZS)</label>
              <input
                type="number"
                name="price"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Stock Qty</label>
              <input
                type="number"
                name="stock_quantity"
                min="0"
                value={formData.stock_quantity}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
              <textarea
                name="description"
                rows={1}
                value={formData.description}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent resize-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Low Stock Threshold</label>
              <input
                type="number"
                name="low_stock_threshold"
                min="0"
                value={formData.low_stock_threshold}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Notify Threshold</label>
              <input
                type="number"
                name="notify_threshold"
                min="0"
                value={formData.notify_threshold}
                onChange={handleChange}
                className="w-full px-4 py-3 bg-surface border border-surface-300 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              name="requires_prescription"
              checked={formData.requires_prescription}
              onChange={(e) => setFormData({ ...formData, requires_prescription: e.target.checked })}
              className="w-4 h-4 rounded border-surface-300 text-accent focus:ring-accent"
            />
            <label className="text-sm text-gray-400">Requires Prescription</label>
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-accent hover:bg-accent2 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <Link to={`/catalog/${product.id}`} className="px-6 py-2.5 bg-surface-200 hover:bg-surface-300 text-white rounded-lg font-medium transition-colors">
              View Inventory
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
