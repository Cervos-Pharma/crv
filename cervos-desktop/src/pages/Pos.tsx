import { useState, useEffect, useRef } from "react";
import { Fe, Pe, Et, Mt } from "../lib/database";
import { qs, processSyncQueue } from "../lib/sync";
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
    let animationId: number | null = null;
    let scanInterval: number | null = null;

    async function startCamera() {
      if (!detectorSupported) {
        setError("Barcode scanning not supported in this browser. Please use manual entry below.");
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
        setError("Camera access denied. Please allow camera permissions or use manual entry below.");
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
      if (animationId) cancelAnimationFrame(animationId);
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
    <div className="fixed inset-0 bg-black/80 flex flex-col z-50">
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
            <p className="text-white/60 text-sm mt-2">Use Chrome on Android for camera scanning, or enter barcode manually below</p>
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
          <button
            type="submit"
            className="px-6 py-3 rounded-lg bg-primary text-white font-bold"
          >
            Add
          </button>
        </form>
        <p className="text-center text-white/60 text-sm mt-2">
          {detectorSupported ? "Point camera at barcode or QR code" : "Enter barcode number above and press Add"}
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

interface CartItem {
  batch: Batch;
  product: Product;
  quantity: number;
  unit_price: number;
}

const PAYMENT_METHODS = ["cash", "card", "mobile_money", "insurance"];

export default function Pos() {
  const { currentOperator } = useAuthStore()
  const [products, setProducts] = useState<Product[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [tenderAmount, setTenderAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [isProcessing, setIsProcessing] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const prods = await Fe("SELECT * FROM products");
    const bats = await Fe("SELECT * FROM batches WHERE quantity > 0");
    setProducts(prods);
    setBatches(bats);
  }

  function findProductByBarcode(barcodeStr: string): { product: Product; batch: Batch } | null {
    if (!barcodeStr.trim()) return null;

    const productByBarcode = products.find((p) => p.barcode === barcodeStr);
    if (productByBarcode) {
      const batch = batches.find((b) => b.product_id === productByBarcode.id);
      if (batch) return { product: productByBarcode, batch };
    }

    const batchById = batches.find((b) => b.id === barcodeStr);
    if (batchById) {
      const product = products.find((p) => p.id === batchById.product_id);
      if (product) return { product, batch: batchById };
    }

    return null;
  }

  function addToCart(item: CartItem) {
    setCart((prev) => {
      const existing = prev.find(
        (c) => c.batch.id === item.batch.id
      );
      if (existing) {
        return prev.map((c) =>
          c.batch.id === item.batch.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      }
      return [...prev, item];
    });
  }

  function handleBarcodeScan(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const found = findProductByBarcode(barcode);
    if (found) {
      addToCart({
        batch: found.batch,
        product: found.product,
        quantity: 1,
        unit_price: found.batch.sale_price,
      });
    }
    setBarcode("");
  }

  function handleSearchBarcode() {
    if (!searchQuery) return;
    const found = findProductByBarcode(searchQuery);
    if (found) {
      addToCart({
        batch: found.batch,
        product: found.product,
        quantity: 1,
        unit_price: found.batch.sale_price,
      });
    }
    setSearchQuery("");
  }

  function handleBarcodeScanned(scannedBarcode: string) {
    const found = findProductByBarcode(scannedBarcode);
    if (found) {
      addToCart({
        batch: found.batch,
        product: found.product,
        quantity: 1,
        unit_price: found.batch.sale_price,
      });
    }
    setShowScanner(false);
  }

  function updateQuantity(batchId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((item) =>
          item.batch.id === batchId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(batchId: string) {
    setCart((prev) => prev.filter((item) => item.batch.id !== batchId));
  }

  function getSubtotal(): number {
    return cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  }

  function getTax(): number {
    return getSubtotal() * 0.1;
  }

  function getTotal(): number {
    return getSubtotal() + getTax() - parseFloat(discount || "0");
  }

  function getChange(): number {
    const tender = parseFloat(tenderAmount || "0");
    return Math.max(0, tender - getTotal());
  }

  async function processSale() {
    if (cart.length === 0 || isProcessing) return;

    setIsProcessing(true);
    try {
      const branchResult = await Fe("SELECT value FROM app_settings WHERE key = 'branch_id'")
      const branchId = branchResult.length > 0 ? JSON.parse(branchResult[0].value) : null

      const saleId = Et();
      const receiptId = Et();
      const receiptNumber = `RCP-${Date.now().toString(36).toUpperCase()}`;
      const now = Mt();
      const total = getTotal();
      const tender = parseFloat(tenderAmount || "0") || total;

      await Pe(
        `INSERT INTO sales (id, branch_id, operator_id, total, discount, tax, tender, change_due, payment_method, payment_ref, created_at, synced)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          saleId,
          branchId,
          currentOperator?.id || null,
          total,
          parseFloat(discount || "0"),
          getTax(),
          tender,
          getChange(),
          paymentMethod,
          null,
          now,
          0,
        ]
      );

      for (const item of cart) {
        const saleItemId = Et();
        await Pe(
          `INSERT INTO sale_items (id, sale_id, batch_id, quantity, unit_price) VALUES (?,?,?,?,?)`,
          [saleItemId, saleId, item.batch.id, item.quantity, item.unit_price]
        );
        await Pe(
          `UPDATE batches SET quantity = quantity - ? WHERE id = ?`,
          [item.quantity, item.batch.id]
        );
      }

      await Pe(
        `INSERT INTO receipts (id, sale_id, receipt_number, created_at) VALUES (?,?,?,?)`,
        [receiptId, saleId, receiptNumber, now]
      );

      await qs("sales", saleId, "insert", {
        id: saleId,
        branch_id: branchId,
        operator_id: currentOperator?.id || null,
        total,
        discount: parseFloat(discount || "0"),
        tax: getTax(),
        tender,
        change_due: getChange(),
        payment_method: paymentMethod,
        created_at: now,
      });

      setCart([]);
      setTenderAmount("");
      setDiscount("0");
      loadData();

      processSyncQueue().catch(console.error);
    } catch (err) {
      console.error("Sale processing failed:", err);
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <>
      {showScanner && (
        <BarcodeScanner onScan={handleBarcodeScanned} onClose={() => setShowScanner(false)} />
      )}
      <div className="flex h-full">
        <div className="flex-1 flex flex-col p-6">
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <div className="flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Scan barcode or type manually..."
                className="flex-1 px-4 py-3 rounded-lg border border-outline-variant bg-surface-base text-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                autoFocus
              />
              <button
                onClick={() => setShowScanner(true)}
                className="px-4 py-3 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                title="Scan barcode"
                type="button"
              >
                <span className="material-symbols-outlined">qr_code_scanner</span>
              </button>
            </div>
          </div>
          <div className="w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearchBarcode()}
              placeholder="Search products..."
              className="w-full px-4 py-3 rounded-lg border border-outline-variant bg-surface-base focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-surface-base border border-outline-variant rounded-xl">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
              <span className="material-symbols-outlined text-6xl">receipt_long</span>
              <p className="mt-2 text-lg font-medium">No items in cart</p>
              <p className="text-sm">Scan a barcode or search for products</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-outline-variant/50 sticky top-0">
                <tr className="text-left text-xs font-semibold text-on-surface-variant uppercase">
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-center">Qty</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item) => (
                  <tr key={item.batch.id} className="border-t border-outline-variant">
                    <td className="px-4 py-3">
                      <p className="font-medium text-sm">{item.product.generic_name}</p>
                      <p className="text-xs text-on-surface-variant">
                        {item.product.brand_name || "Generic"}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${item.unit_price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => updateQuantity(item.batch.id, -1)}
                          className="w-8 h-8 rounded-full bg-outline-variant hover:bg-primary hover:text-white transition-colors flex items-center justify-center"
                        >
                          -
                        </button>
                        <span className="w-8 text-center font-medium">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.batch.id, 1)}
                          className="w-8 h-8 rounded-full bg-outline-variant hover:bg-primary hover:text-white transition-colors flex items-center justify-center"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ${(item.unit_price * item.quantity).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeFromCart(item.batch.id)}
                        className="p-1 rounded hover:bg-error/10 text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-xl">
                          delete
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="w-80 bg-surface-base border-l border-outline-variant p-6 flex flex-col">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
          Payment
        </h2>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Payment Method
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            >
              {PAYMENT_METHODS.map((method) => (
                <option key={method} value={method}>
                  {method.replace("_", " ").toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Discount ($)
            </label>
            <input
              type="number"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              min="0"
              step="0.01"
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-on-surface-variant mb-1">
              Amount Tendered ($)
            </label>
            <input
              type="number"
              value={tenderAmount}
              onChange={(e) => setTenderAmount(e.target.value)}
              min="0"
              step="0.01"
              placeholder={getTotal().toFixed(2)}
              className="w-full px-3 py-2 rounded-md border border-outline-variant bg-surface-base text-sm focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="border-t border-outline-variant pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Subtotal</span>
            <span>${getSubtotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-on-surface-variant">Tax (10%)</span>
            <span>${getTax().toFixed(2)}</span>
          </div>
          {parseFloat(discount || "0") > 0 && (
            <div className="flex justify-between text-sm text-secondary">
              <span>Discount</span>
              <span>-${parseFloat(discount || "0").toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between font-headline text-xl font-black">
            <span>Total</span>
            <span>${getTotal().toFixed(2)}</span>
          </div>
          {parseFloat(tenderAmount || "0") > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">Change</span>
              <span className="text-secondary font-semibold">
                ${getChange().toFixed(2)}
              </span>
            </div>
          )}
        </div>

        <div className="mt-auto pt-4">
          <button
            onClick={processSale}
            disabled={cart.length === 0 || isProcessing}
            className="w-full py-4 rounded-xl bg-primary text-on-primary font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <span className="material-symbols-outlined animate-spin">
                  progress_activity
                </span>
                Processing...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined">check_circle</span>
                Complete Sale
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
