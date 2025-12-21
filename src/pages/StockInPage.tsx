import { useState, useCallback, useRef, useEffect } from 'react';
import { BrowserMultiFormatReader } from '@zxing/library';
import { apiFetch } from '../utils/mockApi';

interface StockInPayload {
  barcode: string;
  quantity: number;
  lot: string;
  expire_date: string;
}

interface StockInResponse {
  id: string;
  barcode: string;
  product_name: string;
  quantity: number;
  lot: string;
  expire_date: string;
  message?: string;
}

interface StockInError {
  message: string;
}

export default function StockInPage() {
  // Form state
  const [formData, setFormData] = useState<StockInPayload>({
    barcode: '',
    quantity: 1,
    lot: '',
    expire_date: '',
  });

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);

  // Barcode scanning state
  const [scanning, setScanning] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Initialize barcode reader
  useEffect(() => {
    codeReaderRef.current = new BrowserMultiFormatReader();

    return () => {
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }
    };
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
  const handleBarcodeDetected = useCallback((detectedBarcode: string) => {
    setFormData((prev) => ({
      ...prev,
      barcode: detectedBarcode,
    }));
    setScanning(false);

    // Stop scanning
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
  }, []);

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScanning(false);
  }, []);

  // Handle form field changes
  const handleFormChange = (
    field: keyof StockInPayload,
    value: string | number
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear error for this field when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.barcode.trim()) {
      errors.barcode = 'Barcode is required';
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = 'Quantity must be greater than 0';
    }

    if (!formData.lot.trim()) {
      errors.lot = 'Lot number is required';
    }

    if (!formData.expire_date.trim()) {
      errors.expire_date = 'Expire date is required';
    } else {
      const expireDate = new Date(formData.expire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expireDate.setHours(0, 0, 0, 0);

      if (expireDate <= today) {
        errors.expire_date = 'Expire date must be in the future';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Handle form submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSubmitSuccess(false);

    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await apiFetch('/api/stock/in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          barcode: formData.barcode.trim(),
          quantity: formData.quantity,
          lot: formData.lot.trim(),
          expire_date: formData.expire_date,
        }),
      });

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status})`);
        }
        try {
          const errorData: StockInError = await response.json();
          throw new Error(errorData.message || `Failed to add stock: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to add stock: ${response.status} ${response.statusText}`);
        }
      }

      if (!isJson) {
        throw new Error('API endpoint returned non-JSON response');
      }

      await response.json();

      // Success: reset form and show success message
      setSubmitSuccess(true);
      setFormData({
        barcode: '',
        quantity: 1,
        lot: '',
        expire_date: '',
      });
      setFormErrors({});

      // Hide success message after 3 seconds
      setTimeout(() => {
        setSubmitSuccess(false);
      }, 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'An error occurred while adding stock');
    } finally {
      setSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for date input min attribute
  const getTodayDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Stock In</h1>
          <p className="text-gray-600 mt-1">Add new inventory to stock</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Success Message */}
            {submitSuccess && (
              <div className="bg-green-50 border-2 border-green-500 rounded-lg p-4">
                <div className="flex items-center">
                  <svg
                    className="h-5 w-5 text-green-600 mr-2"
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
                  <p className="text-green-800 font-medium">Stock added successfully!</p>
                </div>
              </div>
            )}

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

            {/* Barcode Field */}
            <div>
              <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">
                Barcode <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="barcode"
                  value={formData.barcode}
                  onChange={(e) => handleFormChange('barcode', e.target.value)}
                  className={`flex-1 px-4 py-2 border ${
                    formErrors.barcode ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
                  placeholder="Scan or enter barcode"
                  disabled={submitting || scanning}
                />
                <button
                  type="button"
                  onClick={scanning ? stopScanning : startScanning}
                  disabled={submitting}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
                >
                  {scanning ? 'Stop Scan' : 'Scan'}
                </button>
              </div>
              {formErrors.barcode && (
                <p className="mt-1 text-sm text-red-600">{formErrors.barcode}</p>
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

            {/* Quantity Field */}
            <div>
              <label htmlFor="quantity" className="block text-sm font-medium text-gray-700 mb-1">
                Quantity <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                id="quantity"
                min="1"
                step="1"
                value={formData.quantity}
                onChange={(e) => handleFormChange('quantity', parseInt(e.target.value) || 0)}
                className={`w-full px-4 py-2 border ${
                  formErrors.quantity ? 'border-red-300' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
                placeholder="Enter quantity"
                disabled={submitting || scanning}
              />
              {formErrors.quantity && (
                <p className="mt-1 text-sm text-red-600">{formErrors.quantity}</p>
              )}
            </div>

            {/* Lot Number Field */}
            <div>
              <label htmlFor="lot" className="block text-sm font-medium text-gray-700 mb-1">
                Lot Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="lot"
                value={formData.lot}
                onChange={(e) => handleFormChange('lot', e.target.value)}
                className={`w-full px-4 py-2 border ${
                  formErrors.lot ? 'border-red-300' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
                placeholder="Enter lot number"
                disabled={submitting || scanning}
              />
              {formErrors.lot && (
                <p className="mt-1 text-sm text-red-600">{formErrors.lot}</p>
              )}
            </div>

            {/* Expire Date Field */}
            <div>
              <label htmlFor="expire_date" className="block text-sm font-medium text-gray-700 mb-1">
                Expire Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                id="expire_date"
                value={formData.expire_date}
                onChange={(e) => handleFormChange('expire_date', e.target.value)}
                min={getTodayDate()}
                className={`w-full px-4 py-2 border ${
                  formErrors.expire_date ? 'border-red-300' : 'border-gray-300'
                } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
                disabled={submitting || scanning}
              />
              {formErrors.expire_date && (
                <p className="mt-1 text-sm text-red-600">{formErrors.expire_date}</p>
              )}
            </div>

            {/* Submit Button */}
            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting || scanning}
                className="w-full bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
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
                    Adding Stock...
                  </span>
                ) : (
                  'Add Stock'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

