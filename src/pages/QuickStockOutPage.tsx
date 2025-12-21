import { useCallback } from 'react';
import { apiFetch } from '../utils/mockApi';
import StockFormList from '../components/StockFormList';

interface StockFormItem {
  barcode: string;
  product_name: string;
  quantity: number;
  lot?: string;
  expire_date?: string;
  remaining_quantity?: number;
}

interface BulkStockOutResponse {
  success: boolean;
  message: string;
  results: Array<{
    barcode: string;
    product_name: string;
    quantity: number;
    remaining_quantity: number;
  }>;
  errors?: string[];
}

interface BulkStockOutError {
  message: string;
  errors?: string[];
  results?: any[];
}

export default function QuickStockOutPage() {
  // Handle bulk form submit
  const handleSubmit = useCallback(async (items: StockFormItem[]) => {
    const response = await apiFetch('/api/stock/out/bulk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        items: items.map((item) => ({
          barcode: item.barcode.trim(),
          quantity: item.quantity,
        })),
      }),
    });

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!response.ok) {
      if (!isJson) {
        throw new Error(`API endpoint not found or server error (${response.status})`);
      }
      try {
        const errorData: BulkStockOutError = await response.json();
        const errorMessage = errorData.errors && errorData.errors.length > 0
          ? `${errorData.message}: ${errorData.errors.join('; ')}`
          : errorData.message || `Failed to use stock: ${response.statusText}`;
        throw new Error(errorMessage);
      } catch (parseErr) {
        throw new Error(`Failed to use stock: ${response.status} ${response.statusText}`);
      }
    }

    if (!isJson) {
      throw new Error('API endpoint returned non-JSON response');
    }

    const result: BulkStockOutResponse = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to use stock');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Use Stock</h1>
          <p className="text-gray-600 mt-1">Deduct stock from inventory</p>
        </div>

        {/* Form */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <StockFormList mode="OUT" onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
