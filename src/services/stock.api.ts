import apiClient from './api';

/**
 * Stock API Service
 * Handles all stock-related API calls
 */

// Types
export interface ProductInfo {
  product_name: string;
  remaining_quantity: number;
  unit?: string;
  min_stock?: number;
}

export interface StockInRequest {
  barcode: string;
  quantity: number;
}

export interface StockOutRequest {
  barcode: string;
  quantity: number;
}

export interface StockInResponse {
  product_name: string;
  remaining_quantity: number;
  message?: string;
}


export interface DashboardStats {
  total_products: number;
  low_stock_count: number;
  near_expiry_count: number;
  total_stock_value?: number;
}

export interface StockProduct {
  barcode: string;
  product_name: string;
  remaining_quantity: number;
  min_stock: number;
  unit: string;
}

export interface LotDetail {
  lot: string;
  quantity: number;
}

export interface StockMovementSession {
  session_id?: string;
  product_name: string;
  type: 'IN' | 'OUT';
  created_at: string;
  details: LotDetail[];
}

/**
 * Get product information by barcode
 */
export async function getProductByBarcode(barcode: string): Promise<ProductInfo> {
  const response = await apiClient.get<ProductInfo>('/api/stock/products', {
    params: { barcode },
  });
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
  const response = await apiClient.get<{ data: DashboardStats }>('/api/stock/dashboard');
  return response.data.data;
}

/**
 * Get stock list with optional search
 */
export async function getStockList(search?: string): Promise<StockProduct[]> {
  const response = await apiClient.get<{ data: StockProduct[] }>('/api/stock/products', {
    params: search ? { search } : {},
  });
  return response.data.data;
}

/**
 * Get stock movement logs
 */
export async function getStockLogs(filter: 'today' | '7days' = 'today'): Promise<StockMovementSession[]> {
  const response = await apiClient.get<{ data: StockMovementSession[] }>('/api/stock/logs', {
    params: { filter },
  });
  return response.data.data;
}

