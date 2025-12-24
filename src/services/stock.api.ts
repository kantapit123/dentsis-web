import apiClient from './api';

/**
 * Stock API Service
 * Handles all stock-related API calls
 */

// Types
export interface ProductInfo {
  product_name: string;
  name?: string;
  remaining_quantity: number;
  unit?: string;
  min_stock?: number;
}

export interface StockInRequest {
  barcode: string;
  quantity: number;
  lotNumber: string;
  expireDate: string;
}

export interface StockOutRequest {
  barcode: string;
  quantity: number;
}

export interface StockInResponse {
  product_name: string;
  remainingQuantity: number;
  message?: string;
}


export interface DashboardStats {
  totalProducts: number;
  lowStockCount: number;
  nearExpiryCount: number;
  totalStockValue?: number;
  totalStockQuantity?: number;
}

export interface StockProduct {
  id: string;
  name: string;
  barcode: string;
  unit: string;
  minStock: number;
  totalQuantity: number;
  nearExpiry: boolean;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationInfo;
}

export interface LotDetail {
  lot: string;
  quantity: number;
}

export interface StockMovementSession {
  sessionId: string;
  productName: string;
  type: 'IN' | 'OUT';
  createdAt: string;
  totalQuantity: number;
  lots: LotDetail[];
}

/**
 * Get product information by barcode
 */
export async function getProductByBarcode(barcode: string): Promise<ProductInfo> {
  const response = await apiClient.get<ProductInfo>(`/api/stock/${barcode}`);
  return response.data;
}

/**
 * Create a new product
 */
export interface CreateProductRequest {
  barcode: string;
  name: string;
  unit: string;
  minStock?: number;
}

export interface CreateProductResponse {
  barcode: string;
  name: string;
  unit: string;
  minStock: number;
  remainingQuantity: number;
}

export async function createProduct(data: CreateProductRequest): Promise<CreateProductResponse> {
  const response = await apiClient.post<CreateProductResponse>('/api/stock/create', data);
  return response.data;
}

/**
 * Stock In - Add stock (bulk operation)
 * Note: Backend handles lot logic, frontend only sends barcode + quantity
 * Accepts array of items for list-based operations
 */
export async function stockIn(items: StockInRequest[]): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/stock/in', { items });
  return response.data;
}

/**
 * Stock Out - Deduct stock (bulk operation)
 * Note: Backend handles lot logic (FIFO), frontend only sends barcode + quantity
 * Accepts array of items for list-based operations
 */
export async function stockOut(items: StockOutRequest[]): Promise<{ success: boolean; message: string }> {
  const response = await apiClient.post<{ success: boolean; message: string }>('/api/stock/out', { items });
  return response.data;
}

/**
 * Get dashboard statistics
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const response = await apiClient.get<DashboardStats | { data: DashboardStats }>('/api/dashboard');
  // Handle different response structures
  if ('data' in response.data && typeof response.data.data === 'object') {
    return response.data.data;
  }
  return response.data as DashboardStats;
}

/**
 * Get stock list with optional search and pagination
 */
export async function getStockList(
  search?: string,
  page: number = 1,
  limit: number = 20
): Promise<PaginatedResponse<StockProduct>> {
  const params: Record<string, string | number> = {
    page,
    limit,
  };
  if (search) {
    params.search = search;
  }

  const response = await apiClient.get<PaginatedResponse<StockProduct>>('/api/products', {
    params,
  });
  
  // Handle different response structures
  if (Array.isArray(response.data)) {
    // Fallback for non-paginated response
    return {
      data: response.data,
      pagination: {
        page: 1,
        limit: response.data.length,
        total: response.data.length,
        totalPages: 1,
      },
    };
  }
  
  return response.data;
}

/**
 * Get stock movement logs
 */
export async function getStockLogs(filter: 'today' | '7days' = 'today'): Promise<StockMovementSession[]> {
  const response = await apiClient.get<StockMovementSession[] | { data: StockMovementSession[] }>('/api/stock/logs', {
    params: { filter },
  });
  // Handle different response structures
  if (Array.isArray(response.data)) {
    return response.data;
  }
  return response.data?.data || [];
}

