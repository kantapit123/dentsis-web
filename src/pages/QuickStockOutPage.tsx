import { useCallback } from 'react';
import { stockOut } from '../services/stock.api';
import type { StockOutRequest } from '../services/stock.api';
import StockFormList from '../components/StockFormList';

interface StockFormItem {
  barcode: string;
  product_name: string;
  quantity: number;
  lot?: string;
  expire_date?: string;
  remaining_quantity?: number;
}

export default function QuickStockOutPage() {
  // Handle bulk form submit
  // Note: Backend handles lot logic (FIFO), frontend sends barcode + quantity only
  const handleSubmit = useCallback(async (items: StockFormItem[]) => {
    try {
      const requestItems: StockOutRequest[] = items.map((item) => ({
        barcode: item.barcode.trim(),
        quantity: item.quantity,
      }));
      await stockOut(requestItems);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Failed to use stock';
      throw new Error(errorMessage);
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
