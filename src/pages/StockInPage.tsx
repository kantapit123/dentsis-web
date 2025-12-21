import { useCallback } from 'react';
import { apiFetch } from '../utils/mockApi';
import StockForm from '../components/StockForm';

interface StockFormData {
  barcode: string;
  quantity: number;
  lot?: string;
  expire_date?: string;
}

interface StockInError {
  message: string;
}

export default function StockInPage() {
  // Handle form submit
  const handleSubmit = useCallback(async (data: StockFormData) => {
    const response = await apiFetch('/api/stock/in', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        barcode: data.barcode.trim(),
        quantity: data.quantity,
        lot: data.lot?.trim(),
        expire_date: data.expire_date,
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
  }, []);

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
          <StockForm mode="IN" onSubmit={handleSubmit} />
        </div>
      </div>
    </div>
  );
}
