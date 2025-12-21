import { BrowserMultiFormatReader } from "@zxing/library";
import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "../services/api";

interface StockFormData {
  barcode: string;
  quantity: number;
  lot?: string;
  expire_date?: string;
}

interface ProductInfo {
  product_name: string;
  remaining_quantity: number;
}

interface StockFormProps {
  mode: "IN" | "OUT";
  onSubmit: (
    data: StockFormData
  ) => Promise<{ remaining_quantity?: number } | void>;
}

export default function StockForm({ mode, onSubmit }: StockFormProps) {
  // Form state
  const [formData, setFormData] = useState<StockFormData>({
    barcode: "",
    quantity: 1,
    lot: "",
    expire_date: "",
  });

  // Product info (auto-filled after barcode scan/entry)
  const [productName, setProductName] = useState<string>("");
  const [remainingQuantity, setRemainingQuantity] = useState<number | null>(
    null
  );

  // Form validation errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<boolean>(false);
  const [fetchingProduct, setFetchingProduct] = useState<boolean>(false);

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

  // Fetch product information by barcode
  const fetchProductInfo = useCallback(
    async (barcode: string) => {
      setFetchingProduct(true);
      setSubmitError(null);
      setProductName("");
      setRemainingQuantity(null);

      try {
        const response = await apiClient.get(
          `/api/stock/product?barcode=${encodeURIComponent(barcode)}`
        );

        const contentType = response.headers["content-type"] || "";
        const isJson = contentType.includes("application/json");

        if (response.status !== 200) {
          if (!isJson) {
            throw new Error(
              `API endpoint not found or server error (${response.status})`
            );
          }
          try {
            const errorData = response.data;
            throw new Error(
              errorData.message ||
                `Failed to fetch product: ${response.statusText}`
            );
          } catch (parseErr) {
            throw new Error(
              `Failed to fetch product: ${response.status} ${response.statusText}`
            );
          }
        }

        if (!isJson) {
          throw new Error("API endpoint returned non-JSON response");
        }

        const data: ProductInfo = response.data;
        setProductName(data.product_name);
        setRemainingQuantity(data.remaining_quantity);

        // For OUT mode, check if stock is insufficient
        if (mode === "OUT" && data.remaining_quantity <= 0) {
          setSubmitError(
            "Stock is insufficient. Remaining quantity is 0 or below."
          );
        }
      } catch (err) {
        setSubmitError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching product info"
        );
        setProductName("");
        setRemainingQuantity(null);
      } finally {
        setFetchingProduct(false);
      }
    },
    [mode]
  );

  // Start barcode scanning
  const startScanning = useCallback(async () => {
    if (!codeReaderRef.current || !videoRef.current) return;

    try {
      setScanning(true);
      setSubmitError(null);

      // Get available video input devices
      const videoInputDevices =
        await codeReaderRef.current.listVideoInputDevices();
      const deviceId = videoInputDevices[0]?.deviceId;

      if (!deviceId) {
        throw new Error("No camera device found");
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
          if (error && error.name !== "NotFoundException") {
            console.debug("Scan error:", error);
          }
        }
      );
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Failed to access camera"
      );
      setScanning(false);
    }
  }, []);

  // Handle barcode detection - fetch product info
  const handleBarcodeDetected = useCallback(
    async (detectedBarcode: string) => {
      setFormData((prev) => ({
        ...prev,
        barcode: detectedBarcode,
      }));
      setScanning(false);

      // Stop scanning
      if (codeReaderRef.current) {
        codeReaderRef.current.reset();
      }

      // Fetch product info
      await fetchProductInfo(detectedBarcode);
    },
    [fetchProductInfo]
  );

  // Stop scanning
  const stopScanning = useCallback(() => {
    if (codeReaderRef.current) {
      codeReaderRef.current.reset();
    }
    setScanning(false);
  }, []);

  // Handle form field changes
  const handleFormChange = (
    field: keyof StockFormData,
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

  // Handle barcode input change (fetch product info when barcode changes)
  const handleBarcodeChange = useCallback(
    async (value: string) => {
      handleFormChange("barcode", value);

      // Fetch product info if barcode is provided
      if (value.trim()) {
        await fetchProductInfo(value.trim());
      } else {
        setProductName("");
        setRemainingQuantity(null);
      }
    },
    [fetchProductInfo]
  );

  // Validate form
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.barcode.trim()) {
      errors.barcode = "Barcode is required";
    }

    if (!formData.quantity || formData.quantity <= 0) {
      errors.quantity = "Quantity must be greater than 0";
    }

    // For IN mode, validate lot and expire_date
    if (mode === "IN") {
      // if (!formData.lot?.trim()) {
      //   errors.lot = "Lot number is required";
      // }

      if (formData.expire_date) {
        const expireDate = new Date(formData.expire_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expireDate.setHours(0, 0, 0, 0);

        if (expireDate <= today) {
          errors.expire_date = "Expire date must be in the future";
        }
      }
    }

    // For OUT mode, validate product exists and stock is sufficient
    if (mode === "OUT") {
      if (!productName) {
        errors.barcode = "Product not found. Please check the barcode.";
      }

      if (remainingQuantity !== null && remainingQuantity <= 0) {
        errors.quantity =
          "Stock is insufficient. Remaining quantity is 0 or below.";
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
      const result = await onSubmit(formData);

      // Update remaining quantity if provided in response (for OUT mode)
      if (
        result &&
        "remaining_quantity" in result &&
        result.remaining_quantity !== undefined
      ) {
        setRemainingQuantity(result.remaining_quantity);
      }

      // Success: reset form and show success message
      setSubmitSuccess(true);
      setFormData({
        barcode: "",
        quantity: 1,
        lot: "",
        expire_date: "",
      });
      setProductName("");
      setFormErrors({});

      // Hide success message after 3 seconds and reset remaining quantity
      setTimeout(() => {
        setSubmitSuccess(false);
        setRemainingQuantity(null);
      }, 3000);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  // Get today's date in YYYY-MM-DD format for date input min attribute
  const getTodayDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  };

  // Get button text and style based on mode
  const getButtonConfig = () => {
    if (mode === "OUT") {
      return {
        text: "Use Item",
        loadingText: "Using Item...",
        className: "bg-red-600 hover:bg-red-700 focus:ring-red-500",
      };
    }
    return {
      text: "Add Stock",
      loadingText: "Adding Stock...",
      className: "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500",
    };
  };

  const buttonConfig = getButtonConfig();

  return (
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
            <div className="flex-1">
              <p className="text-green-800 font-medium">
                {mode === "OUT"
                  ? "Item used successfully!"
                  : "Stock added successfully!"}
              </p>
              {mode === "OUT" &&
                remainingQuantity !== null &&
                remainingQuantity !== undefined && (
                  <p className="text-green-700 text-sm mt-1">
                    Remaining quantity: {remainingQuantity.toLocaleString()}
                  </p>
                )}
            </div>
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
        <label
          htmlFor="barcode"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Barcode <span className="text-red-500">*</span>
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            id="barcode"
            value={formData.barcode}
            onChange={(e) => handleBarcodeChange(e.target.value)}
            className={`flex-1 px-4 py-2 border ${
              formErrors.barcode ? "border-red-300" : "border-gray-300"
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
            placeholder="Scan or enter barcode"
            disabled={submitting || scanning || fetchingProduct}
          />
          <button
            type="button"
            onClick={scanning ? stopScanning : startScanning}
            disabled={submitting || fetchingProduct}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium whitespace-nowrap"
          >
            {scanning ? "Stop Scan" : "Scan"}
          </button>
        </div>
        {formErrors.barcode && (
          <p className="mt-1 text-sm text-red-600">{formErrors.barcode}</p>
        )}
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

      {/* Product Name Field (auto-filled, read-only) - shown for OUT mode or when product is found */}
      {(mode === "OUT" || productName) && (
        <div>
          <label
            htmlFor="product_name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Product Name
          </label>
          <input
            type="text"
            id="product_name"
            value={productName || ""}
            readOnly
            className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-700 cursor-not-allowed"
            disabled
          />
        </div>
      )}

      {/* Quantity Field */}
      <div>
        <label
          htmlFor="quantity"
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          Quantity <span className="text-red-500">*</span>
        </label>
        <input
          type="number"
          id="quantity"
          min="1"
          step="1"
          value={formData.quantity}
          onChange={(e) =>
            handleFormChange("quantity", parseInt(e.target.value) || 0)
          }
          className={`w-full px-4 py-2 border ${
            formErrors.quantity ? "border-red-300" : "border-gray-300"
          } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
          placeholder="Enter quantity"
          disabled={submitting || scanning || fetchingProduct}
        />
        {formErrors.quantity && (
          <p className="mt-1 text-sm text-red-600">{formErrors.quantity}</p>
        )}
        {mode === "OUT" &&
          remainingQuantity !== null &&
          remainingQuantity !== undefined &&
          !submitSuccess && (
            <p className="mt-1 text-sm text-gray-500">
              Current stock: {remainingQuantity.toLocaleString()} units
            </p>
          )}
      </div>

      {/* Lot Number Field (IN mode only) */}
      {mode === "IN" && (
        <div>
          <label
            htmlFor="lot"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Lot Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lot"
            value={formData.lot || ""}
            onChange={(e) => handleFormChange("lot", e.target.value)}
            className={`w-full px-4 py-2 border ${
              formErrors.lot ? "border-red-300" : "border-gray-300"
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
            placeholder="Enter lot number"
            disabled={submitting || scanning || fetchingProduct}
          />
          {formErrors.lot && (
            <p className="mt-1 text-sm text-red-600">{formErrors.lot}</p>
          )}
        </div>
      )}

      {/* Expire Date Field (IN mode only) */}
      {mode === "IN" && (
        <div>
          <label
            htmlFor="expire_date"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Expire Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            id="expire_date"
            value={formData.expire_date || ""}
            onChange={(e) => handleFormChange("expire_date", e.target.value)}
            min={getTodayDate()}
            className={`w-full px-4 py-2 border ${
              formErrors.expire_date ? "border-red-300" : "border-gray-300"
            } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition`}
            disabled={submitting || scanning || fetchingProduct}
          />
          {formErrors.expire_date && (
            <p className="mt-1 text-sm text-red-600">
              {formErrors.expire_date}
            </p>
          )}
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-4">
        <button
          type="submit"
          disabled={
            submitting ||
            scanning ||
            fetchingProduct ||
            (mode === "OUT" && !productName)
          }
          className={`w-full ${buttonConfig.className} text-white font-semibold py-3 px-6 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed`}
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
              {buttonConfig.loadingText}
            </span>
          ) : (
            buttonConfig.text
          )}
        </button>
      </div>
    </form>
  );
}
