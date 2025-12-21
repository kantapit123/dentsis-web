import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { getProductByBarcode } from '../services/stock.api';
import type { ProductInfo } from '../services/stock.api';
import AddProductModal from './AddProductModal';

interface StockFormItem {
  barcode: string;
  product_name: string;
  quantity: number;
  lot?: string;
  expire_date?: string;
  remaining_quantity?: number;
}

interface StockFormListProps {
  mode: 'IN' | 'OUT';
  onSubmit: (items: StockFormItem[]) => Promise<void>;
}

export default function StockFormList({ mode, onSubmit }: StockFormListProps) {
  // List of items
  const [items, setItems] = useState<StockFormItem[]>([]);

  // Barcode input state
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [currentQuantity, setCurrentQuantity] = useState<number>(1);
  const [currentLot, setCurrentLot] = useState<string>('');
  const [currentExpireDate, setCurrentExpireDate] = useState<string>('');

  // UI state
  const [fetchingProduct, setFetchingProduct] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Add product modal state
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [pendingBarcode, setPendingBarcode] = useState<string>('');

  // Barcode scanning state
  const [scanning, setScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
  }, []);

  // Auto-focus barcode input
  useEffect(() => {
    if (barcodeInputRef.current && !scanning && !submitting) {
      barcodeInputRef.current.focus();
    }
  }, [items, scanning, submitting]);

  // Show toast message
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 2000);
  }, []);

  // Fetch product information by barcode
  const fetchProductInfo = useCallback(async (barcode: string): Promise<ProductInfo | null> => {
    setFetchingProduct(true);
    setSubmitError(null);

    try {
      const data = await getProductByBarcode(barcode);
      return data;
    } catch (err: any) {
      // If 404, show add product modal
      if (err?.response?.status === 404) {
        setPendingBarcode(barcode);
        setShowAddProductModal(true);
        return null;
      }
      const errorMessage = err?.response?.data?.message || err?.message || 'An error occurred while fetching product info';
      setSubmitError(errorMessage);
      return null;
    } finally {
      setFetchingProduct(false);
    }
  }, []);


  // Start barcode scanning
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      setScanning(true);
      setSubmitError(null);

      // Get available video input devices
      const videoInputDevices = await codeReaderRef.current.listVideoInputDevices();
      const deviceId = videoInputDevices[0]?.deviceId;

      if (!deviceId) {
        throw new Error('No camera device found');
      }

      // Start decoding from video device
      codeReaderRef.current.decodeFromVideoDevice(
        deviceId,
        videoRef.current,
        (result, error) => {
          if (result) {
            const detectedBarcode = result.getText();
            handleBarcodeDetected(detectedBarcode);
          }
          if (error && error.name !== 'NotFoundException') {
            console.debug('Scan error:', error);
          }
        }
      );
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to access camera');
      setScanning(false);
    }
  }, []);

  // Handle barcode detection
  const handleBarcodeDetected = useCallback(async (detectedBarcode: string) => {
    setBarcodeInput(detectedBarcode);
    setScanning(false);

    // Stop scanning
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }

    // Add to list
    await handleAddToList(detectedBarcode);
  }, []);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScanning(false);
  }, []);

  // Handle add to list
  const handleAddToList = useCallback(async (barcode?: string) => {
    const barcodeToUse = barcode || barcodeInput.trim();
    if (!barcodeToUse) return;

    // Fetch product info
    const productInfo = await fetchProductInfo(barcodeToUse);
    if (!productInfo) return;

    // For OUT mode, check stock availability
    if (mode === 'OUT') {
      if (productInfo.remaining_quantity <= 0) {
        setSubmitError(`Stock is insufficient for ${productInfo.product_name}. Remaining quantity is ${productInfo.remaining_quantity}.`);
        return;
      }
      if (currentQuantity > productInfo.remaining_quantity) {
        setSubmitError(`Insufficient stock. Available: ${productInfo.remaining_quantity}, Requested: ${currentQuantity}`);
        return;
      }
    }

    // Check if product already exists in list
    // For IN mode: match by barcode + lot + expire_date
    // For OUT mode: match by barcode only
    const existingIndex = items.findIndex((item) => {
      if (item.barcode !== barcodeToUse) return false;
      if (mode === 'IN') {
        return item.lot === currentLot.trim() && item.expire_date === currentExpireDate;
      }
      return true; // OUT mode: match by barcode only
    });

    if (existingIndex !== -1) {
      // Merge quantities for existing item
      const existingItem = items[existingIndex];
      const newQuantity = existingItem.quantity + currentQuantity;

      // For OUT mode, validate total quantity doesn't exceed stock
      if (mode === 'OUT' && productInfo.remaining_quantity < newQuantity) {
        setSubmitError(`Insufficient stock. Available: ${productInfo.remaining_quantity}, Total requested: ${newQuantity}`);
        return;
      }

      setItems((prev) =>
        prev.map((item, index) =>
          index === existingIndex
            ? {
                ...item,
                quantity: newQuantity,
              }
            : item
        )
      );
      showToast(`${productInfo.product_name} quantity updated`);
    } else {
      // Add new item
      const newItem: StockFormItem = {
        barcode: barcodeToUse,
        product_name: productInfo.product_name,
        quantity: currentQuantity,
        remaining_quantity: productInfo.remaining_quantity,
      };

      // For IN mode, require lot and expire_date
      if (mode === 'IN') {
        if (!currentLot.trim()) {
          setSubmitError('Lot number is required');
          return;
        }
        if (!currentExpireDate.trim()) {
          setSubmitError('Expire date is required');
          return;
        }
        newItem.lot = currentLot.trim();
        newItem.expire_date = currentExpireDate;
      }

      setItems((prev) => [...prev, newItem]);
      showToast(`${productInfo.product_name} added to list`);
    }

    // Reset input fields
    setBarcodeInput('');
    setCurrentQuantity(1);
    setCurrentLot('');
    setCurrentExpireDate('');
  }, [barcodeInput, currentQuantity, currentLot, currentExpireDate, items, mode, fetchProductInfo, showToast]);

  // Handle product creation success - retry adding to list
  const handleProductCreated = useCallback(async () => {
    const barcodeToRetry = pendingBarcode;
    setShowAddProductModal(false);
    setPendingBarcode('');
    
    if (!barcodeToRetry) return;
    
    // Retry adding to list (will fetch product info again, which should now succeed)
    await handleAddToList(barcodeToRetry);
  }, [pendingBarcode, handleAddToList]);

  // Handle remove item
  const handleRemoveItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Handle quantity change
  const handleQuantityChange = useCallback((index: number, newQuantity: number) => {
    if (newQuantity <= 0) return;

    const item = items[index];

    // For OUT mode, validate quantity doesn't exceed remaining stock
    if (mode === 'OUT' && item.remaining_quantity !== undefined && newQuantity > item.remaining_quantity) {
      setSubmitError(`Insufficient stock. Available: ${item.remaining_quantity}`);
      return;
    }

    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, quantity: newQuantity } : item))
    );
  }, [items, mode]);

  // Handle lot/expire change for IN mode
  const handleItemFieldChange = useCallback(
    (index: number, field: 'lot' | 'expire_date', value: string) => {
      setItems((prev) =>
        prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
      );
    },
    []
  );

  // Handle confirm submit
  const handleConfirm = useCallback(async () => {
    if (items.length === 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      await onSubmit(items);

      // Success: clear list
      setItems([]);
      setBarcodeInput('');
      setCurrentQuantity(1);
      setCurrentLot('');
      setCurrentExpireDate('');
      showToast(mode === 'OUT' ? 'All items used successfully!' : 'All items added successfully!');
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }, [items, onSubmit, mode, showToast]);

  // Get today's date in YYYY-MM-DD format for date input min attribute
  const getTodayDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toastMessage}
        </div>
      )}

      <div className="space-y-4 pb-24">
        {/* Error Message */}
        {submitError && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-start">
              <svg
                className="h-5 w-5 text-red-600 mt-0.5 mr-2 flex-shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-red-800 text-sm">{submitError}</p>
            </div>
          </div>
        )}

        {/* Barcode Input Section */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label htmlFor="barcode-input" className="block text-sm font-medium text-gray-700 mb-1">
              Barcode
            </label>
            <div className="flex gap-2">
              <input
                ref={barcodeInputRef}
                type="text"
                id="barcode-input"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !scanning && !fetchingProduct) {
                    e.preventDefault();
                    handleAddToList();
                  }
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="Scan or enter barcode"
                disabled={submitting || scanning || fetchingProduct}
              />
              <button
                type="button"
                onClick={scanning ? stopScanning : startScanning}
                disabled={submitting || fetchingProduct}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
              >
                {scanning ? 'Stop Scan' : 'Scan'}
              </button>
            </div>
            {fetchingProduct && (
              <p className="mt-1 text-sm text-gray-500">Fetching product info...</p>
            )}

            {/* Camera Preview (when scanning) */}
            {scanning && (
              <div className="mt-4 relative w-full max-w-md aspect-square bg-black rounded-lg overflow-hidden border-4 border-gray-700">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="border-2 border-blue-500 rounded-lg w-3/4 h-3/4 animate-pulse"></div>
                </div>
                <div className="absolute bottom-4 left-0 right-0 text-center">
                  <p className="text-white text-sm font-medium bg-black/70 px-4 py-2 rounded-lg inline-block">
                    Position barcode within frame
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Quantity Input (for adding new items) */}
          <div>
            <label htmlFor="quantity-input" className="block text-sm font-medium text-gray-700 mb-1">
              Quantity
            </label>
            <input
              type="number"
              id="quantity-input"
              min="1"
              step="1"
              value={currentQuantity}
              onChange={(e) => setCurrentQuantity(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
              disabled={submitting || scanning || fetchingProduct}
            />
          </div>

          {/* Lot and Expire Date (IN mode only, for new items) */}
          {mode === 'IN' && (
            <>
              <div>
                <label htmlFor="lot-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Lot Number
                </label>
                <input
                  type="text"
                  id="lot-input"
                  value={currentLot}
                  onChange={(e) => setCurrentLot(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  placeholder="Enter lot number"
                  disabled={submitting || scanning || fetchingProduct}
                />
              </div>
              <div>
                <label htmlFor="expire-date-input" className="block text-sm font-medium text-gray-700 mb-1">
                  Expire Date
                </label>
                <input
                  type="date"
                  id="expire-date-input"
                  value={currentExpireDate}
                  onChange={(e) => setCurrentExpireDate(e.target.value)}
                  min={getTodayDate()}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                  disabled={submitting || scanning || fetchingProduct}
                />
              </div>
            </>
          )}

          {/* Add to List Button */}
          <button
            type="button"
            onClick={() => handleAddToList()}
            disabled={!barcodeInput.trim() || submitting || scanning || fetchingProduct}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Add to List
          </button>
        </div>

        {/* Items List */}
        {items.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-gray-900">Items ({items.length})</h3>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div
                  key={`${item.barcode}-${index}`}
                  className="bg-white border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900">{item.product_name}</div>
                      <div className="text-sm text-gray-500 mt-1 font-mono">{item.barcode}</div>
                      {mode === 'OUT' && item.remaining_quantity !== undefined && item.remaining_quantity != null && (
                        <div className="text-xs text-gray-500 mt-1">
                          Available: {item.remaining_quantity.toLocaleString()} units
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      disabled={submitting}
                      className="text-red-600 hover:text-red-700 disabled:opacity-50"
                      aria-label="Remove item"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    {/* Quantity Input */}
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                        disabled={submitting}
                      />
                    </div>

                    {/* Lot and Expire Date (IN mode only, editable) */}
                    {mode === 'IN' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Lot Number
                          </label>
                          <input
                            type="text"
                            value={item.lot || ''}
                            onChange={(e) => handleItemFieldChange(index, 'lot', e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            disabled={submitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 mb-1">
                            Expire Date
                          </label>
                          <input
                            type="date"
                            value={item.expire_date || ''}
                            onChange={(e) => handleItemFieldChange(index, 'expire_date', e.target.value)}
                            min={getTodayDate()}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm"
                            disabled={submitting}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Sticky Bottom Action Bar */}
      {items.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg p-4 z-40">
          <div className="max-w-2xl mx-auto">
            <button
              type="button"
              onClick={handleConfirm}
              disabled={submitting || items.length === 0}
              className={`w-full ${
                mode === 'OUT'
                  ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                  : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
              } text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {submitting ? (
                <span className="flex items-center justify-center">
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {mode === 'OUT' ? 'Using Items...' : 'Adding Items...'}
                </span>
              ) : (
                mode === 'OUT' ? 'Use All Items' : 'Confirm Stock In'
              )}
            </button>
          </div>
        </div>
      )}

      {/* Add Product Modal */}
      <AddProductModal
        barcode={pendingBarcode}
        isOpen={showAddProductModal}
        onClose={() => {
          setShowAddProductModal(false);
          setPendingBarcode('');
        }}
        onSuccess={handleProductCreated}
      />
    </>
  );
}

