import { useState, useEffect, useCallback } from "react";
import { getDashboardStats, getStockList } from "../services/stock.api";
import type {
  DashboardStats,
  StockProduct,
  PaginatedResponse,
} from "../services/stock.api";

// Debounce hook for search input
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Stock list state
  const [stockList, setStockList] = useState<StockProduct[]>([]);
  const [loadingStockList, setLoadingStockList] = useState<boolean>(false);
  const [stockListError, setStockListError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<
    "lowStock" | "nearExpiry" | "inStock" | "outOfStock" | "expired" | ""
  >("");

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pagination, setPagination] = useState<{
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  } | null>(null);

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.message ||
        "An error occurred while fetching dashboard stats";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce search query (300ms delay)
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch stock list
  const fetchStockList = useCallback(
    async (
      search: string,
      page: number = 1,
      status?: "lowStock" | "nearExpiry" | "inStock" | "outOfStock" | "expired"
    ) => {
      setLoadingStockList(true);
      setStockListError(null);

      try {
        const response: PaginatedResponse<StockProduct> = await getStockList(
          search.trim() || undefined,
          page,
          10,
          status
        );
        setStockList(response.data || []);
        setPagination(response.pagination);
      } catch (err: any) {
        const errorMessage =
          err?.response?.data?.message ||
          err?.message ||
          "An error occurred while fetching stock list";
        setStockListError(errorMessage);
        setStockList([]);
        setPagination(null);
      } finally {
        setLoadingStockList(false);
      }
    },
    []
  );

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // Fetch stock list when debounced search changes, page changes, or status filter changes
  useEffect(() => {
    fetchStockList(debouncedSearch, currentPage, statusFilter || undefined);
  }, [debouncedSearch, currentPage, statusFilter, fetchStockList]);

  // Reset to page 1 when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  // Format currency (if stock value is provided)
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Format date for display
  const formatDate = (dateString?: string): string => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  // Check if product is expired
  const isExpired = (expireDate?: string): boolean => {
    if (!expireDate) return false;
    try {
      const expire = new Date(expireDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expire.setHours(0, 0, 0, 0);
      return expire < today;
    } catch {
      return false;
    }
  };

  // Stock Row Component (reusable)
  const StockRow = ({ product }: { product: StockProduct }) => {
    const remainingQty = product.totalQuantity ?? 0;
    const minStock = product.minStock ?? 0;
    const isOutOfStock = remainingQty === 0;
    const isLowStock = remainingQty > 0 && remainingQty <= minStock;
    const expired = isExpired(product.expireDate);

    const getRowClasses = () => {
      if (expired) {
        return "bg-red-100 hover:bg-red-200";
      } else if (isOutOfStock) {
        return "bg-red-50 hover:bg-red-100";
      } else if (isLowStock) {
        return "bg-yellow-50 hover:bg-yellow-100";
      }
      return "hover:bg-gray-50";
    };

    const getQuantityClasses = () => {
      if (isOutOfStock) {
        return "text-red-600 font-semibold";
      } else if (isLowStock) {
        return "text-yellow-600 font-semibold";
      }
      return "text-gray-900";
    };

    return (
      <tr className={`transition ${getRowClasses()}`}>
        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
          <div className="text-sm font-medium text-gray-900">
            {product.name || "-"}
          </div>
          <div className="text-xs text-gray-500 mt-1 font-mono">
            {product.barcode || "-"}
          </div>
        </td>
        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
          <div className={`text-sm ${getQuantityClasses()}`}>
            {remainingQty.toLocaleString()}
          </div>
        </td>
        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
          <div className="text-sm text-gray-600">{product.unit || "-"}</div>
        </td>
        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
          {expired ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-200 text-red-900 border border-red-400">
              Expired
            </span>
          ) : isOutOfStock ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-300">
              Out of Stock
            </span>
          ) : isLowStock ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-300">
              Low Stock
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-300">
              In Stock
            </span>
          )}
        </td>
        <td className="px-4 md:px-6 py-4 whitespace-nowrap">
          <div
            className={`text-sm ${
              expired ? "text-red-600 font-semibold" : "text-gray-600"
            }`}
          >
            {formatDate(product.expireDate)}
          </div>
        </td>
      </tr>
    );
  };

  // Stat Card Component
  const StatCard = ({
    title,
    value,
    alertType,
    icon,
  }: {
    title: string;
    value: number | string;
    alertType?: "low" | "warning" | "normal";
    icon: React.ReactNode;
  }) => {
    const getCardColors = () => {
      switch (alertType) {
        case "low":
          return "bg-red-50 border-red-300";
        case "warning":
          return "bg-yellow-50 border-yellow-300";
        default:
          return "bg-white border-gray-200";
      }
    };

    const getTextColors = () => {
      switch (alertType) {
        case "low":
          return "text-red-600";
        case "warning":
          return "text-yellow-600";
        default:
          return "text-gray-900";
      }
    };

    return (
      <div
        className={`rounded-lg border-2 p-6 ${getCardColors()} transition hover:shadow-md`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600 mb-2">{title}</p>
            <p className={`text-3xl font-bold ${getTextColors()}`}>
              {typeof value === "number" && value != null
                ? value.toLocaleString()
                : value ?? "-"}
            </p>
          </div>
          <div
            className={`${
              alertType === "low"
                ? "text-red-500"
                : alertType === "warning"
                ? "text-yellow-500"
                : "text-gray-400"
            }`}
          >
            {icon}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Stock Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of clinic inventory</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
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
              onClick={fetchStats}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
          </div>
        )}

        {/* Stats Grid */}
        {!loading && !error && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Total Products */}
            <StatCard
              title="Total Products"
              value={stats.totalProducts}
              icon={
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              }
            />

            {/* Low Stock Count */}
            <StatCard
              title="Low Stock"
              value={stats.lowStockCount}
              alertType={stats.lowStockCount > 0 ? "low" : "normal"}
              icon={
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              }
            />

            {/* Near Expiry Count */}
            <StatCard
              title="Near Expiry"
              value={stats.nearExpiryCount}
              alertType={stats.nearExpiryCount > 0 ? "warning" : "normal"}
              icon={
                <svg
                  className="h-8 w-8"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
            />

            {/* Expired Products Count */}
            {stats.expiredCount !== undefined && (
              <StatCard
                title="Expired"
                value={stats.expiredCount}
                alertType={stats.expiredCount > 0 ? "low" : "normal"}
                icon={
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
            )}

            {/* Total Stock Value (Optional) */}
            {stats.totalStockValue !== undefined && (
              <StatCard
                title="Total Stock Value"
                value={formatCurrency(stats.totalStockValue)}
                icon={
                  <svg
                    className="h-8 w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                }
              />
            )}
          </div>
        )}

        {/* Stock List Section */}
        {!loading && !error && (
          <div className="mt-8">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              <div className="px-4 md:px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Stock List
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Search products by name or barcode
                </p>
              </div>

              {/* Search Input and Status Filter */}
              <div className="px-4 md:px-6 py-4 border-b border-gray-200 space-y-4">
                <input
                  type="text"
                  placeholder="Search by product name or barcode..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                />

                {/* Status Filter */}
                <div className="flex flex-wrap gap-2">
                  <label className="text-sm font-medium text-gray-700 self-center">
                    Status:
                  </label>
                  <button
                    onClick={() => setStatusFilter("")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === ""
                        ? "bg-blue-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setStatusFilter("inStock")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === "inStock"
                        ? "bg-green-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    In Stock
                  </button>
                  <button
                    onClick={() => setStatusFilter("lowStock")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === "lowStock"
                        ? "bg-yellow-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Low Stock
                  </button>
                  <button
                    onClick={() => setStatusFilter("outOfStock")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === "outOfStock"
                        ? "bg-red-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Out of Stock
                  </button>
                  <button
                    onClick={() => setStatusFilter("nearExpiry")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === "nearExpiry"
                        ? "bg-orange-600 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Near Expiry
                  </button>
                  <button
                    onClick={() => setStatusFilter("expired")}
                    className={`px-4 py-2 text-sm font-medium rounded-lg transition ${
                      statusFilter === "expired"
                        ? "bg-red-700 text-white"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Expired
                  </button>
                </div>
              </div>

              {/* Loading State */}
              {loadingStockList && (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-4 text-gray-600">Loading stock list...</p>
                </div>
              )}

              {/* Error State */}
              {stockListError && !loadingStockList && (
                <div className="p-12 text-center">
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
                  <p className="text-red-600 font-medium">{stockListError}</p>
                  <button
                    onClick={() =>
                      fetchStockList(
                        debouncedSearch,
                        currentPage,
                        statusFilter || undefined
                      )
                    }
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Stock Table */}
              {!loadingStockList && !stockListError && (
                <>
                  {!stockList || stockList.length === 0 ? (
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
                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">
                        No products found
                      </p>
                      {searchQuery && (
                        <p className="text-gray-500 text-sm mt-1">
                          Try a different search term
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Product
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Quantity
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Unit
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-4 md:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Expire Date
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {stockList &&
                            stockList.map((product) => (
                              <StockRow key={product.id} product={product} />
                            ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Pagination */}
                  {pagination && (
                    <div className="px-4 md:px-6 py-4 border-t border-gray-200">
                      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        {/* Page Info */}
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">
                            {pagination.total.toLocaleString()}
                          </span>{" "}
                          results
                        </div>

                        {/* Pagination Controls */}
                        <div className="flex items-center gap-2">
                          {/* Previous Button */}
                          <button
                            onClick={() =>
                              setCurrentPage((prev) => Math.max(1, prev - 1))
                            }
                            disabled={currentPage === 1 || loadingStockList}
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            Previous
                          </button>

                          {/* Page Numbers */}
                          <div className="flex items-center gap-1">
                            {Array.from(
                              { length: Math.min(5, pagination.totalPages) },
                              (_, i) => {
                                let pageNum: number;
                                if (pagination.totalPages <= 5) {
                                  pageNum = i + 1;
                                } else if (currentPage <= 3) {
                                  pageNum = i + 1;
                                } else if (
                                  currentPage >=
                                  pagination.totalPages - 2
                                ) {
                                  pageNum = pagination.totalPages - 4 + i;
                                } else {
                                  pageNum = currentPage - 2 + i;
                                }

                                return (
                                  <button
                                    key={pageNum}
                                    onClick={() => setCurrentPage(pageNum)}
                                    disabled={loadingStockList}
                                    className={`px-3 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition ${
                                      currentPage === pageNum
                                        ? "bg-blue-600 text-white"
                                        : "text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
                                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                                  >
                                    {pageNum}
                                  </button>
                                );
                              }
                            )}
                          </div>

                          {/* Next Button */}
                          <button
                            onClick={() =>
                              setCurrentPage((prev) =>
                                Math.min(pagination.totalPages, prev + 1)
                              )
                            }
                            disabled={
                              currentPage === pagination.totalPages ||
                              loadingStockList
                            }
                            className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
