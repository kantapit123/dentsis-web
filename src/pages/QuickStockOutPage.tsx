import { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { apiFetch } from '../utils/mockApi';

interface StockOutResponse {
  product_name: string;
  remaining_quantity: number;
}

interface StockOutError {
  message: string;
}

export default function QuickStockOutPage() {
  const [scanning, setScanning] = useState<boolean>(true);
  const [productName, setProductName] = useState<string | null>(null);
  const [remainingQuantity, setRemainingQuantity] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [barcode, setBarcode] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();
    
    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // Start camera scanning
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      setError(null);
      setScanning(true);
      setProductName(null);
      setRemainingQuantity(null);
      setSuccess(false);
      setBarcode(null);

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
            // NotFoundException is normal when no barcode is visible
            console.debug('Scan error:', error);
          }
        }
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to access camera');
      setScanning(false);
    }
  }, []);

  // Handle barcode detection - automatically call API as per requirements
  const handleBarcodeDetected = useCallback(async (detectedBarcode: string) => {
    // Prevent duplicate scans
    if (barcode === detectedBarcode || loading) return;
    
    setBarcode(detectedBarcode);
    setLoading(true);
    setError(null);
    setScanning(false);

    // Stop scanning
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }

    try {
      // Fetch product info (without deducting)
      const response = await apiFetch(`/api/stock/product?barcode=${encodeURIComponent(detectedBarcode)}`, {
        method: 'GET',
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status})`);
        }
        try {
          const errorData: StockOutError = await response.json();
          throw new Error(errorData.message || `Failed to fetch product: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to fetch product: ${response.status} ${response.statusText}`);
        }
      }

      if (!isJson) {
        throw new Error('API endpoint returned non-JSON response');
      }

      const data: StockOutResponse = await response.json();
      setProductName(data.product_name);
      setRemainingQuantity(data.remaining_quantity);
      
      // Check if stock is insufficient (remaining quantity is 0 or negative)
      if (data.remaining_quantity <= 0) {
        setError('Stock is insufficient. Remaining quantity is 0 or below.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching product info');
      setProductName(null);
      setRemainingQuantity(null);
    } finally {
      setLoading(false);
    }
  }, [barcode, loading]);

  // Start scanning on mount
  useEffect(() => {
    startScanning();
  }, [startScanning]);

  // Handle Use Item button click - deduct stock immediately
  const handleUseItem = useCallback(async () => {
    if (!barcode || loading) return;

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const response = await apiFetch('/api/stock/out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: barcode,
          quantity: 1,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status})`);
        }
        try {
          const errorData: StockOutError = await response.json();
          throw new Error(errorData.message || `Failed to process stock out: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to process stock out: ${response.status} ${response.statusText}`);
        }
      }

      if (!isJson) {
        throw new Error('API endpoint returned non-JSON response');
      }

      const data: StockOutResponse = await response.json();
      setProductName(data.product_name);
      setRemainingQuantity(data.remaining_quantity);
      
      if (data.remaining_quantity < 0) {
        setError('Stock is insufficient. Remaining quantity is below 0.');
      } else if (data.remaining_quantity === 0) {
        setError('Stock is insufficient. Remaining quantity is 0.');
      } else {
        // Show success feedback for 500ms
        setSuccess(true);
        scanTimeoutRef.current = setTimeout(() => {
          setSuccess(false);
          // Reset and restart scanning after success feedback
          if (codeReaderRef.current) {
            codeReaderRef.current.reset();
          }
          setProductName(null);
          setRemainingQuantity(null);
          setBarcode(null);
          setError(null);
          startScanning();
        }, 500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while processing stock out');
    } finally {
      setLoading(false);
    }
  }, [barcode, loading, startScanning]);

  // Handle restart scanning
  const handleRestartScanning = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    if (scanTimeoutRef.current) {
      clearTimeout(scanTimeoutRef.current);
    }
    setProductName(null);
    setRemainingQuantity(null);
    setBarcode(null);
    setError(null);
    setSuccess(false);
    startScanning();
  }, [startScanning]);

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-4 border-b border-gray-700">
        <h1 className="text-2xl font-bold text-white">Quick Stock Out</h1>
        <p className="text-gray-400 text-sm mt-1">Scan barcode to use item</p>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        {/* Camera View */}
        {scanning && (
          <div className="w-full max-w-md flex flex-col items-center">
            <div className="relative w-full aspect-square bg-black rounded-lg overflow-hidden border-4 border-gray-700">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              {/* Scanning overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="border-2 border-blue-500 rounded-lg w-3/4 h-3/4 animate-pulse"></div>
              </div>
              {/* Instruction text */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <p className="text-white text-sm font-medium bg-black/70 px-4 py-2 rounded-lg inline-block">
                  Position barcode within frame
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Product Info Display */}
        {!scanning && productName && (
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-6 space-y-4">
            {/* Success Indicator */}
            {success && (
              <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4 text-center animate-pulse">
                <svg
                  className="mx-auto h-12 w-12 text-green-600 mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-green-800 font-semibold">Stock deducted successfully!</p>
              </div>
            )}

            {/* Product Details */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Product Name
                </label>
                <p className="text-xl font-bold text-gray-900 mt-1">{productName}</p>
              </div>
              
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Remaining Quantity
                </label>
                <p className={`text-2xl font-bold mt-1 ${
                  remainingQuantity !== null && remainingQuantity < 0
                    ? 'text-red-600'
                    : remainingQuantity !== null && remainingQuantity <= 5
                    ? 'text-yellow-600'
                    : 'text-gray-900'
                }`}>
                  {remainingQuantity !== null ? remainingQuantity : '—'}
                </p>
              </div>

              {barcode && (
                <div className="pt-2 border-t border-gray-200">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Barcode
                  </label>
                  <p className="text-sm text-gray-600 mt-1 font-mono">{barcode}</p>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
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
                  <p className="text-red-800 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-4 space-y-2">
              <button
                onClick={handleUseItem}
                disabled={loading}
                className="w-full bg-blue-600 text-white font-semibold py-4 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              >
                Use Item
              </button>

              <button
                onClick={handleRestartScanning}
                disabled={loading}
                className="w-full bg-gray-200 text-gray-800 font-medium py-3 px-6 rounded-lg hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Scan Another Item
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && !productName && (
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Processing barcode...</p>
          </div>
        )}

        {/* Error State (when no product info to show) */}
        {error && !productName && !loading && (
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="text-red-600 mb-4">
              <svg
                className="mx-auto h-16 w-16"
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
            </div>
            <p className="text-red-600 font-medium mb-4">{error}</p>
            <button
              onClick={handleRestartScanning}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

