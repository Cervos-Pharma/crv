import { useState, useEffect } from "react";
import { Fe, Pe, Et } from "../lib/database";
import { PHARMACY_CATEGORIES } from "../lib/branding";
import type { Product, Batch } from "../types";

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const prods = await Fe("SELECT * FROM products ORDER BY generic_name");
    const bats = await Fe("SELECT * FROM batches");
    setProducts(prods);
    setBatches(bats);
    setIsLoading(false);
  }

  function getStockForProduct(productId: string): number {
    return batches
      .filter((b) => b.product_id === productId)
      .reduce((sum, b) => sum + (b.quantity || 0), 0);
  }

  function getLowStockProducts(): Product[] {
    return products.filter((p) => getStockForProduct(p.id) <= 10);
  }

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      !searchQuery ||
      p.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.brand_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.barcode?.includes(searchQuery);
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <span className="material-symbols-outlined animate-spin text-3xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-headline text-2xl font-black text-on-surface">
            Inventory
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            {products.length} products · {batches.filter((b) => b.quantity > 0).length} batches in stock
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">add</span>
          Add Product
        </button>
      </div>

      {getLowStockProducts().length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-amber-800">
            <span className="material-symbols-outlined">warning</span>
            <span className="font-semibold">
              {getLowStockProducts().length} products low on stock
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {getLowStockProducts().slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded-full"
              >
                {p.generic_name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or barcode..."
            className="w-full px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="px-4 py-2.5 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary"
        >
          <option value="">All Categories</option>
          {PHARMACY_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-surface-base border border-outline-variant rounded-xl overflow-hidden">
        <table className="w-full">
          <thead className="bg-outline-variant/50">
            <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Price</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((product) => {
              const stock = getStockForProduct(product.id);
              const cheapestBatch = batches
                .filter((b) => b.product_id === product.id)
                .sort((a, b) => a.cost_price - b.cost_price)[0];
              const mostExpensiveBatch = batches
                .filter((b) => b.product_id === product.id)
                .sort((a, b) => b.sale_price - a.sale_price)[0];

              return (
                <tr
                  key={product.id}
                  className="border-t border-outline-variant hover:bg-outline-variant/30"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm">{product.generic_name}</p>
                    {product.brand_name && (
                      <p className="text-xs text-on-surface-variant">
                        {product.brand_name}
                      </p>
                    )}
                    {product.requires_prescription ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-100 text-amber-800 text-xs rounded mt-1">
                        <span className="material-symbols-outlined text-xs">
                          medical_information
                        </span>
                        Rx
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {product.category || "Uncategorized"}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">
                    {product.barcode || "—"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-semibold ${
                      stock <= 10 ? "text-error" : "text-on-surface"
                    }`}
                  >
                    {stock}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    ${cheapestBatch?.cost_price.toFixed(2) || "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    ${mostExpensiveBatch?.sale_price.toFixed(2) || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setEditingProduct(product)}
                      className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined">edit</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-on-surface-variant">
            <span className="material-symbols-outlined text-5xl">inventory_2</span>
            <p className="mt-2 font-medium">No products found</p>
          </div>
        )}
      </div>

      {(showAddModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={async (productData) => {
            if (editingProduct) {
              await Pe(
                `UPDATE products SET generic_name = ?, brand_name = ?, category = ?, requires_prescription = ?, barcode = ? WHERE id = ?`,
                [
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                  editingProduct.id,
                ]
              );
            } else {
              const id = Et();
              await Pe(
                `INSERT INTO products (id, generic_name, brand_name, category, requires_prescription, barcode) VALUES (?,?,?,?,?,?)`,
                [
                  id,
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                ]
              );
            }
            loadData();
            setShowAddModal(false);
            setEditingProduct(null);
          }}
        />
      )}
    </div>
  );
}

interface ProductModalProps {
  product: Product | null;
  onClose: () => void;
  onSave: (data: {
    generic_name: string;
    brand_name: string;
    category: string;
    requires_prescription: boolean;
    barcode: string;
  }) => void;
}

function ProductModal({ product, onClose, onSave }: ProductModalProps) {
  const [genericName, setGenericName] = useState(product?.generic_name || "");
  const [brandName, setBrandName] = useState(product?.brand_name || "");
  const [category, setCategory] = useState(product?.category || "");
  const [requiresPrescription, setRequiresPrescription] = useState(
    !!product?.requires_prescription
  );
  const [barcode, setBarcode] = useState(product?.barcode || "");

  const inputClass =
    "w-full px-3 py-2.5 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const labelClass = "block text-xs font-semibold text-on-surface-variant mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      generic_name: genericName.trim(),
      brand_name: brandName.trim(),
      category,
      requires_prescription: requiresPrescription,
      barcode: barcode.trim(),
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            {product ? "Edit Product" : "Add Product"}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-outline-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Generic Name *</label>
            <input
              type="text"
              value={genericName}
              onChange={(e) => setGenericName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Paracetamol"
              required
            />
          </div>

          <div>
            <label className={labelClass}>Brand Name</label>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className={inputClass}
              placeholder="e.g. Panadol"
            />
          </div>

          <div>
            <label className={labelClass}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={inputClass}
            >
              <option value="">Select category</option>
              {PHARMACY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelClass}>Barcode</label>
            <input
              type="text"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              className={inputClass}
              placeholder="e.g. 1234567890123"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires_prescription"
              checked={requiresPrescription}
              onChange={(e) => setRequiresPrescription(e.target.checked)}
              className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary"
            />
            <label
              htmlFor="requires_prescription"
              className="text-sm text-on-surface"
            >
              Requires prescription
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-md border border-outline-variant text-on-surface font-medium hover:bg-outline-variant/30 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-md bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
            >
              {product ? "Update" : "Add Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
