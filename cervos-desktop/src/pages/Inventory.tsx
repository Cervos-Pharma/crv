import { useState, useEffect, useRef } from "react";
import { Fe, Pe, Et, Mt } from "../lib/database";
import { qs, runSyncCycle } from "../lib/sync";
import { PHARMACY_CATEGORIES } from "../lib/branding";
import { useAuthStore } from "../lib/store";
import type { Product, Batch } from "../types";

function BarcodeScanner({ onScan, onClose }: { onScan: (barcode: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [detectorSupported] = useState(() => typeof window !== 'undefined' && !!window.BarcodeDetector);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let scanInterval: number | null = null;

    async function startCamera() {
      if (!detectorSupported) {
        setError("Barcode scanning not supported. Please use manual entry below.");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          scanInterval = window.setInterval(scanFrame, 200);
        }
      } catch (err) {
        setError("Camera access denied. Please use manual entry below.");
      }
    }

    async function scanFrame() {
      if (!videoRef.current || !canvasRef.current || !window.BarcodeDetector) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA || video.videoWidth === 0) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      try {
        const barcodeDetector = new window.BarcodeDetector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "qr_code"] });
        const barcodes = await barcodeDetector.detect(canvas);
        if (barcodes.length > 0) {
          onScan(barcodes[0].rawValue);
          return;
        }
      } catch {
      }
    }

    startCamera();
    return () => {
      if (scanInterval) clearInterval(scanInterval);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [onScan, detectorSupported]);

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualBarcode.trim()) {
      onScan(manualBarcode.trim());
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex flex-col z-[100]">
      <div className="flex items-center justify-between p-4 text-white">
        <h3 className="font-bold">Scan Barcode / QR</h3>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center relative">
        {detectorSupported ? (
          <>
            <video ref={videoRef} className="w-full max-h-full object-cover" playsInline muted />
            <canvas ref={canvasRef} className="hidden" />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-2 border-white rounded-lg" />
            </div>
          </>
        ) : (
          <div className="text-center text-white p-6">
            <span className="material-symbols-outlined text-6xl text-white/40">qr_code_scanner</span>
            <p className="mt-4 text-lg">Camera scanning not available</p>
            <p className="text-white/60 text-sm mt-2">Use Chrome on Android for camera, or enter manually below</p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <div className="text-center text-white p-6">
              <span className="material-symbols-outlined text-5xl text-error">error</span>
              <p className="mt-2">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-4">
        <form onSubmit={handleManualSubmit} className="flex gap-2 max-w-md mx-auto">
          <input
            type="text"
            value={manualBarcode}
            onChange={(e) => setManualBarcode(e.target.value)}
            placeholder="Enter barcode manually..."
            className="flex-1 px-4 py-3 rounded-lg bg-white text-black text-lg"
          />
          <button type="submit" className="px-6 py-3 rounded-lg bg-primary text-white font-bold">
            Add
          </button>
        </form>
        <p className="text-center text-white/60 text-sm mt-2">
          {detectorSupported ? "Point camera at barcode or QR code" : "Enter barcode number above"}
        </p>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => {
      detect(source: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
    };
  }
}

export default function Inventory() {
  const { isAdmin, permissions } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [productBatches, setProductBatches] = useState<Batch[]>([]);
  const [productSales, setProductSales] = useState<any[]>([]);

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

  async function loadProductDetails(product: Product) {
    const bats = batches.filter((b) => b.product_id === product.id);
    setProductBatches(bats);
    const salesData = await Fe(`
      SELECT si.*, s.created_at as sale_date, s.payment_method
      FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.batch_id IN (${bats.map(() => '?').join(',') || 'NULL'})
      ORDER BY s.created_at DESC
      LIMIT 50
    `, bats.map(b => b.id));
    setProductSales(salesData);
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

  function handleProductClick(product: Product) {
    if (!isAdmin && permissions.canViewInventoryDetail) {
      loadProductDetails(product);
      setViewingProduct(product);
    } else {
      setEditingProduct(product);
    }
  }

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
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary font-semibold hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined">add</span>
            Add Product
          </button>
        )}
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
              <th className="px-4 py-3">Formulation</th>
              <th className="px-4 py-3">Barcode</th>
              <th className="px-4 py-3 text-right">Stock</th>
              <th className="px-4 py-3 text-right">Cost</th>
              <th className="px-4 py-3 text-right">Price</th>
              {isAdmin && <th className="px-4 py-3"></th>}
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
                  <td className="px-4 py-3 cursor-pointer" onClick={() => handleProductClick(product)}>
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
                  <td className="px-4 py-3 text-sm text-on-surface-variant">
                    {product.formulation || "—"}
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
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditingProduct(product)}
                        className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
                      >
                        <span className="material-symbols-outlined">edit</span>
                      </button>
                    </td>
                  )}
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

      {viewingProduct && (
        <ProductDetailModal
          product={viewingProduct}
          batches={productBatches}
          sales={productSales}
          onClose={() => {
            setViewingProduct(null);
            setProductBatches([]);
            setProductSales([]);
          }}
        />
      )}

      {(showAddModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          onClose={() => {
            setShowAddModal(false);
            setEditingProduct(null);
          }}
          onSave={async (productData) => {
            const now = Mt();
            let productId: string;
            if (editingProduct) {
              productId = editingProduct.id;
              await Pe(
                `UPDATE products SET generic_name = ?, brand_name = ?, category = ?, formulation = ?, requires_prescription = ?, barcode = ?, default_expiry = ?, default_cost_price = ?, default_sale_price = ?, updated_at = ? WHERE id = ?`,
                [
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.formulation,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                  productData.default_expiry || null,
                  productData.default_cost_price || null,
                  productData.default_sale_price || null,
                  now,
                  editingProduct.id,
                ]
              );
              await qs("products", productId, "update", {
                id: productId,
                generic_name: productData.generic_name,
                brand_name: productData.brand_name,
                category: productData.category,
                formulation: productData.formulation,
                requires_prescription: productData.requires_prescription ? 1 : 0,
                barcode: productData.barcode,
                default_expiry: productData.default_expiry || null,
                default_cost_price: productData.default_cost_price || null,
                default_sale_price: productData.default_sale_price || null,
                updated_at: now,
              });
            } else {
              productId = Et();
              await Pe(
                `INSERT INTO products (id, generic_name, brand_name, category, formulation, requires_prescription, barcode, default_expiry, default_cost_price, default_sale_price, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
                [
                  productId,
                  productData.generic_name,
                  productData.brand_name,
                  productData.category,
                  productData.formulation,
                  productData.requires_prescription ? 1 : 0,
                  productData.barcode,
                  productData.default_expiry || null,
                  productData.default_cost_price || null,
                  productData.default_sale_price || null,
                  now,
                ]
              );
              await qs("products", productId, "insert", {
                id: productId,
                generic_name: productData.generic_name,
                brand_name: productData.brand_name,
                category: productData.category,
                formulation: productData.formulation,
                requires_prescription: productData.requires_prescription ? 1 : 0,
                barcode: productData.barcode,
                default_expiry: productData.default_expiry || null,
                default_cost_price: productData.default_cost_price || null,
                default_sale_price: productData.default_sale_price || null,
                updated_at: now,
              });
            }

            if (productData.quantity > 0) {
              const branchRes = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'");
              const branchId = branchRes.length > 0 ? JSON.parse(branchRes[0].value) : null;
              const batchId = Et();
              await Pe(
                `INSERT INTO batches (id, branch_id, product_id, batch_number, quantity, cost_price, sale_price, expiry_date, updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,
                [
                  batchId,
                  branchId,
                  productId,
                  null,
                  productData.quantity,
                  productData.default_cost_price || 0,
                  productData.default_sale_price || 0,
                  productData.default_expiry || null,
                  now,
                ]
              );
              await qs("batches", batchId, "insert", {
                id: batchId,
                branch_id: branchId,
                product_id: productId,
                batch_number: null,
                quantity: productData.quantity,
                cost_price: productData.default_cost_price || 0,
                sale_price: productData.default_sale_price || 0,
                expiry_date: productData.default_expiry || null,
                sync_version: 1,
                updated_at: now,
              });
            }
            loadData();
            setShowAddModal(false);
            setEditingProduct(null);
            runSyncCycle().catch(() => {});
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
    formulation: string;
    requires_prescription: boolean;
    barcode: string;
    quantity: number;
    default_expiry?: string;
    default_cost_price?: number;
    default_sale_price?: number;
  }) => void;
}

const FORMULATIONS = ["Tablet", "Capsule", "Syrup", "Injection", "Cream", "Ointment", "Drops", "Inhaler", "Suppository", "Powder", "Solution", "Suspension", "Gel", "Patch", "Other"]

function ProductModal({ product, onClose, onSave }: ProductModalProps) {
  const [genericName, setGenericName] = useState(product?.generic_name || "");
  const [brandName, setBrandName] = useState(product?.brand_name || "");
  const [category, setCategory] = useState(product?.category || "");
  const [formulation, setFormulation] = useState(product?.formulation || "");
  const [requiresPrescription, setRequiresPrescription] = useState(
    !!product?.requires_prescription
  );
  const [barcode, setBarcode] = useState(product?.barcode || "");
  const [defaultExpiry, setDefaultExpiry] = useState(product?.default_expiry || "");
  const [defaultCostPrice, setDefaultCostPrice] = useState(product?.default_cost_price?.toString() || "");
  const [defaultSalePrice, setDefaultSalePrice] = useState(product?.default_sale_price?.toString() || "");
  const [quantity, setQuantity] = useState(product ? "0" : "1");
  const [showScanner, setShowScanner] = useState(false);

  const inputClass =
    "w-full px-3 py-2.5 rounded-md border border-outline-variant bg-white text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary";
  const labelClass = "block text-xs font-semibold text-on-surface-variant mb-1";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      generic_name: genericName.trim(),
      brand_name: brandName.trim(),
      category,
      formulation,
      requires_prescription: requiresPrescription,
      barcode: barcode.trim(),
      quantity: parseInt(quantity, 10) || 0,
      default_expiry: defaultExpiry || undefined,
      default_cost_price: defaultCostPrice ? parseFloat(defaultCostPrice) : undefined,
      default_sale_price: defaultSalePrice ? parseFloat(defaultSalePrice) : undefined,
    });
  }

  function handleBarcodeScanned(scannedBarcode: string) {
    setBarcode(scannedBarcode);
    setShowScanner(false);
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
      )}
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
              <label className={labelClass}>Formulation</label>
              <select
                value={formulation}
                onChange={(e) => setFormulation(e.target.value)}
                className={inputClass}
              >
                <option value="">Select formulation</option>
                {FORMULATIONS.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={labelClass}>Barcode</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className={inputClass}
                  placeholder="e.g. 1234567890123"
                />
                <button
                  type="button"
                  onClick={() => setShowScanner(true)}
                  className="px-3 py-2.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  title="Scan barcode"
                >
                  <span className="material-symbols-outlined">qr_code_scanner</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className={labelClass}>Default Expiry</label>
                <input
                  type="date"
                  value={defaultExpiry}
                  onChange={(e) => setDefaultExpiry(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Cost/Unit</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={defaultCostPrice}
                  onChange={(e) => setDefaultCostPrice(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
              <label className={labelClass}>Sell/Unit</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={defaultSalePrice}
                onChange={(e) => setDefaultSalePrice(e.target.value)}
                className={inputClass}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className={labelClass}>Stock Qty</label>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className={inputClass}
                placeholder="0"
              />
            </div>
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
    </>
  );
}

interface ProductDetailModalProps {
  product: Product;
  batches: Batch[];
  sales: any[];
  onClose: () => void;
}

function ProductDetailModal({ product, batches, sales, onClose }: ProductDetailModalProps) {
  const totalStock = batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
  const totalSales = sales.reduce((sum, s) => sum + (s.quantity || 0), 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-base rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-headline text-xl font-bold text-on-surface">
            Product Details
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-outline-variant transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-surface p-4 rounded-xl border border-outline-variant">
            <h3 className="font-semibold text-lg">{product.generic_name}</h3>
            {product.brand_name && (
              <p className="text-sm text-on-surface-variant">{product.brand_name}</p>
            )}
            <div className="flex gap-4 mt-3 text-sm">
              <span className="text-on-surface-variant">Category: <span className="text-on-surface">{product.category || 'N/A'}</span></span>
              <span className="text-on-surface-variant">Barcode: <span className="text-on-surface font-mono">{product.barcode || 'N/A'}</span></span>
            </div>
            {product.requires_prescription ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-800 text-xs rounded mt-2">
                <span className="material-symbols-outlined text-xs">medical_information</span>
                Requires Prescription
              </span>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">Total Stock</p>
              <p className={`font-headline text-2xl font-black mt-1 ${totalStock <= 10 ? 'text-error' : 'text-on-surface'}`}>
                {totalStock}
              </p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">Units Sold</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{totalSales}</p>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-outline-variant text-center">
              <p className="text-xs font-semibold text-on-surface-variant uppercase">Batch Count</p>
              <p className="font-headline text-2xl font-black text-on-surface mt-1">{batches.length}</p>
            </div>
          </div>

          <div>
            <h3 className="font-headline font-bold text-on-surface mb-3">Batch History</h3>
            <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-outline-variant/50">
                  <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
                    <th className="px-4 py-2">Batch ID</th>
                    <th className="px-4 py-2 text-right">Expiry</th>
                    <th className="px-4 py-2 text-right">Qty</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                    <th className="px-4 py-2 text-right">Price</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-on-surface-variant">No batches found</td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="border-t border-outline-variant">
                        <td className="px-4 py-2 font-mono text-xs">{batch.id.slice(0, 8)}...</td>
                        <td className="px-4 py-2 text-right">{batch.expiry_date ? new Date(batch.expiry_date).toLocaleDateString() : 'N/A'}</td>
                        <td className={`px-4 py-2 text-right font-semibold ${batch.quantity <= 10 ? 'text-error' : ''}`}>{batch.quantity}</td>
                        <td className="px-4 py-2 text-right">${batch.cost_price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">${batch.sale_price.toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {sales.length > 0 && (
            <div>
              <h3 className="font-headline font-bold text-on-surface mb-3">Recent Sales</h3>
              <div className="bg-surface rounded-xl border border-outline-variant overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-outline-variant/50">
                    <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2 text-right">Qty</th>
                      <th className="px-4 py-2 text-right">Unit Price</th>
                      <th className="px-4 py-2 text-right">Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.slice(0, 10).map((sale, idx) => (
                      <tr key={idx} className="border-t border-outline-variant">
                        <td className="px-4 py-2">{sale.sale_date ? new Date(sale.sale_date).toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-2 text-right">{sale.quantity}</td>
                        <td className="px-4 py-2 text-right">${sale.unit_price.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right">{sale.payment_method || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
