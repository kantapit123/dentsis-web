import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '../utils/mockApi';

interface StockMovement {
  id: string;
  barcode: string;
  product_name: string;
  type: 'IN' | 'OUT';
  quantity: number;
  created_at: string;
}

interface StockMovementResponse {
  data: StockMovement[];
}

type DateFilter = 'today' | '7days';

export default function StockMovementLogPage() {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');

  // Fetch stock movements
  const fetchMovements = useCallback(async (filter: DateFilter) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/stock/movements?filter=${filter}`);

      const contentType = response.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');

      if (!response.ok) {
        if (!isJson) {
          throw new Error(`API endpoint not found or server error (${response.status})`);
        }
        try {
          const errorData = await response.json();
          throw new Error(errorData.message || `Failed to fetch stock movements: ${response.statusText}`);
        } catch (parseErr) {
          throw new Error(`Failed to fetch stock movements: ${response.status} ${response.statusText}`);
        }
      }

      if (!isJson) {
        throw new Error('API endpoint returned non-JSON response');
      }

      const data: StockMovementResponse = await response.json();
      setMovements(data.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while fetching stock movements');
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch movements when filter changes
  useEffect(() => {
    fetchMovements(dateFilter);
  }, [dateFilter, fetchMovements]);

  // Format date and time for display
  const formatDateTime = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const movementDate = new Date(date);
      movementDate.setHours(0, 0, 0, 0);

      const isToday = movementDate.getTime() === today.getTime();
      const isYesterday = movementDate.getTime() === today.getTime() - 86400000;

      if (isToday) {
        return `Today, ${date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })}`;
      } else if (isYesterday) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })}`;
      } else {
        return date.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
      }
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Stock Movement Log</h1>
          <p className="text-gray-600 mt-1">History of stock in and out operations</p>
        </div>

        {/* Date Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="text-sm font-medium text-gray-700">Filter by Date:</label>
            <div className="flex gap-2">
              <button
                onClick={() => setDateFilter('today')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === 'today'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Today
              </button>
              <button
                onClick={() => setDateFilter('7days')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  dateFilter === '7days'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Last 7 Days
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading movement log...</p>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="text-red-600 mb-2">
              <svg
                className="mx-auto h-12 w-12"
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
            <p className="text-red-600 font-medium">{error}</p>
            <button
              onClick={() => fetchMovements(dateFilter)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Movements List */}
        {!loading && !error && (
          <div className="bg-white rounded-lg shadow-sm overflow-hidden">
            {movements.length === 0 ? (
              <div className="p-12 text-center">
                <div className="text-gray-400 mb-2">
                  <svg
                    className="mx-auto h-12 w-12"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <p className="text-gray-600 font-medium">No movements found</p>
                <p className="text-gray-500 text-sm mt-1">Try selecting a different date filter</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="p-4 md:p-6 hover:bg-gray-50 transition"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      {/* Left: Product Info and Type */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3">
                          {/* Type Badge */}
                          <span
                            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                              movement.type === 'IN'
                                ? 'bg-green-100 text-green-800 border border-green-300'
                                : 'bg-red-100 text-red-800 border border-red-300'
                            }`}
                          >
                            {movement.type === 'IN' ? (
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 4v16m8-8H4"
                                />
                              </svg>
                            ) : (
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M20 12H4"
                                />
                              </svg>
                            )}
                            {movement.type}
                          </span>

                          {/* Product Info */}
                          <div className="flex-1">
                            <div className="font-semibold text-gray-900">{movement.product_name}</div>
                            <div className="text-sm text-gray-600 mt-1">
                              <span className="font-medium">{movement.quantity.toLocaleString()}</span>
                              {' '}units
                            </div>
                            <div className="text-xs text-gray-500 mt-1 font-mono">{movement.barcode}</div>
                          </div>
                        </div>
                      </div>

                      {/* Right: Time */}
                      <div className="text-sm text-gray-600 whitespace-nowrap">
                        {formatDateTime(movement.created_at)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

