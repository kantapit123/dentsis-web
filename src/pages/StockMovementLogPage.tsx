import { useState, useEffect, useCallback } from 'react';
import { getStockLogs } from '../services/stock.api';
import type { StockMovementSession } from '../services/stock.api';

type DateFilter = 'today' | '7days';

export default function StockMovementLogPage() {
  const [movements, setMovements] = useState<StockMovementSession[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Fetch stock movements
  const fetchMovements = useCallback(async (filter: DateFilter) => {
    setLoading(true);
    setError(null);

    try {
      const data = await getStockLogs(filter);
      setMovements(data);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'An error occurred while fetching stock movements';
      setError(errorMessage);
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch movements when filter changes
  useEffect(() => {
    fetchMovements(dateFilter);
  }, [dateFilter, fetchMovements]);

  // Toggle session expansion
  const toggleSession = useCallback((sessionKey: string) => {
    setExpandedSessions((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sessionKey)) {
        newSet.delete(sessionKey);
      } else {
        newSet.add(sessionKey);
      }
      return newSet;
    });
  }, []);

  // Calculate total quantity from details
  const getTotalQuantity = (details: LotDetail[]): number => {
    return details.reduce((sum, detail) => sum + detail.quantity, 0);
  };

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
                {movements.map((session, index) => {
                  const sessionKey = session.session_id || `session-${index}`;
                  const isExpanded = expandedSessions.has(sessionKey);
                  const totalQuantity = getTotalQuantity(session.details);
                  
                  return (
                    <div
                      key={sessionKey}
                      className="p-4 md:p-6 hover:bg-gray-50 transition"
                    >
                      <div className="flex flex-col gap-3">
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Left: Product Info and Type */}
                          <div className="flex-1">
                            <div className="flex items-start gap-3">
                              {/* Type Badge */}
                              <span
                                className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                  session.type === 'IN'
                                    ? 'bg-green-100 text-green-800 border border-green-300'
                                    : 'bg-red-100 text-red-800 border border-red-300'
                                }`}
                              >
                                {session.type === 'IN' ? (
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
                                {session.type}
                              </span>

                              {/* Product Info */}
                              <div className="flex-1">
                                <div className="font-semibold text-gray-900">{session.product_name}</div>
                                <div className="text-sm text-gray-600 mt-1">
                                  <span className="font-medium">{totalQuantity.toLocaleString()}</span>
                                  {' '}units
                                  {session.details.length > 1 && (
                                    <span className="text-gray-500 ml-2">
                                      ({session.details.length} lot{session.details.length !== 1 ? 's' : ''})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Right: Time and Expand Button */}
                          <div className="flex items-center gap-3">
                            <div className="text-sm text-gray-600 whitespace-nowrap">
                              {formatDateTime(session.created_at)}
                            </div>
                            {session.details.length > 0 && (
                              <button
                                onClick={() => toggleSession(sessionKey)}
                                className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded p-1 transition"
                                aria-label={isExpanded ? 'Collapse lot details' : 'Expand lot details'}
                              >
                                <span className="font-medium">
                                  {isExpanded ? 'Hide' : 'Show'} Details
                                </span>
                                <svg
                                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                                  fill="none"
                                  viewBox="0 0 24 24"
                                  stroke="currentColor"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 9l-7 7-7-7"
                                  />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Lot Details */}
                        {isExpanded && session.details.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="text-xs font-medium text-gray-700 uppercase tracking-wide mb-2">
                              Lot Breakdown
                            </div>
                            <div className="space-y-2">
                              {session.details.map((detail, detailIndex) => (
                                <div
                                  key={detailIndex}
                                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-gray-900">Lot:</span>
                                    <span className="text-sm font-mono text-gray-700">{detail.lot}</span>
                                  </div>
                                  <div className="text-sm text-gray-600">
                                    <span className="font-medium">{detail.quantity.toLocaleString()}</span>
                                    {' '}units
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

