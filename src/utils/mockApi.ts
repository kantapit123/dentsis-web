/**
 * Mock API utility for development
 * 
 * To use mock data instead of real API calls:
 * 1. Set USE_MOCK_API=true in your environment
 * 2. Import this utility and use mockFetch instead of fetch
 * 
 * Example:
 *   const response = await mockFetch('/api/v1/appointments/today');
 */

import appointmentsTodayMock from '../mocks/appointments-today.json';
import patientsMock from '../mocks/patients.json';

// Mutable copies of mock data for state updates
let appointmentsData = JSON.parse(JSON.stringify(appointmentsTodayMock.data));
let patientsData = JSON.parse(JSON.stringify(patientsMock.data));

// Mock stock data (in-memory for development)
interface MockProduct {
  barcode: string;
  product_name: string;
  remaining_quantity: number;
  min_stock: number;
  unit: string;
}

interface MockStockBatch {
  id: string;
  barcode: string;
  lot: string;
  expire_date: string;
  quantity: number;
}

interface MockStockMovement {
  id: string;
  barcode: string;
  product_name: string;
  type: 'IN' | 'OUT';
  quantity: number;
  lot_number?: string;
  session_id?: string;
  created_at: string;
}

let stockData: MockProduct[] = [
  { barcode: '1234567890123', product_name: 'Dental Floss 50m', remaining_quantity: 25, min_stock: 20, unit: 'roll' },
  { barcode: '2345678901234', product_name: 'Toothbrush Soft', remaining_quantity: 15, min_stock: 20, unit: 'piece' },
  { barcode: '3456789012345', product_name: 'Mouthwash 500ml', remaining_quantity: 8, min_stock: 10, unit: 'bottle' },
  { barcode: '4567890123456', product_name: 'Dental Paste', remaining_quantity: 0, min_stock: 5, unit: 'tube' },
  { barcode: '5678901234567', product_name: 'Gloves Medium', remaining_quantity: 50, min_stock: 30, unit: 'pair' },
];

// Mock stock batches for expiry tracking
let stockBatches: MockStockBatch[] = [
  { id: 'batch-1', barcode: '1234567890123', lot: 'LOT001', expire_date: '2025-12-31', quantity: 25 },
  { id: 'batch-2', barcode: '2345678901234', lot: 'LOT002', expire_date: '2025-06-15', quantity: 15 },
  { id: 'batch-3', barcode: '3456789012345', lot: 'LOT003', expire_date: getDateInDays(25), quantity: 8 }, // Near expiry
  { id: 'batch-4', barcode: '4567890123456', lot: 'LOT004', expire_date: '2024-12-01', quantity: 0 },
  { id: 'batch-5', barcode: '5678901234567', lot: 'LOT005', expire_date: '2026-03-20', quantity: 50 },
  { id: 'batch-6', barcode: '3456789012345', lot: 'LOT006', expire_date: getDateInDays(15), quantity: 5 }, // Near expiry
];

// Mock stock movements (track IN/OUT operations)
let stockMovements: MockStockMovement[] = [
  { id: 'mov-1', barcode: '1234567890123', product_name: 'Dental Floss 50m', type: 'IN', quantity: 25, created_at: getDateHoursAgo(2) },
  { id: 'mov-2', barcode: '2345678901234', product_name: 'Toothbrush Soft', type: 'IN', quantity: 15, created_at: getDateHoursAgo(5) },
  { id: 'mov-3', barcode: '1234567890123', product_name: 'Dental Floss 50m', type: 'OUT', quantity: 1, created_at: getDateHoursAgo(1) },
  { id: 'mov-4', barcode: '3456789012345', product_name: 'Mouthwash 500ml', type: 'OUT', quantity: 2, created_at: getDateDaysAgo(2) },
  { id: 'mov-5', barcode: '5678901234567', product_name: 'Gloves Medium', type: 'IN', quantity: 50, created_at: getDateDaysAgo(3) },
  { id: 'mov-6', barcode: '4567890123456', product_name: 'Dental Paste', type: 'OUT', quantity: 5, created_at: getDateDaysAgo(5) },
];

// Helper function to get date X hours ago (for testing)
function getDateHoursAgo(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date.toISOString();
}

// Helper function to get date X days ago (for testing)
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(12, 0, 0, 0); // Set to noon for consistency
  return date.toISOString();
}

// Helper function to get date in X days from now (for testing near expiry)
function getDateInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

// Check if we should use mock API (set in environment or localStorage)
const shouldUseMock = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('USE_MOCK_API') === 'true' || import.meta.env.VITE_USE_MOCK_API === 'true';
  }
  return false;
};

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock fetch function that returns mock data based on the URL
 */
export async function mockFetch(url: string, options?: RequestInit): Promise<Response> {
  // Simulate network delay (200-500ms)
  await delay(200 + Math.random() * 300);

  // Parse URL to determine which mock data to return
  const urlObj = new URL(url, window.location.origin);
  const pathname = urlObj.pathname;
  const searchParams = urlObj.searchParams;

  let mockData: any;
  let status = 200;

  // Route to appropriate mock data
  if (pathname === '/api/stock/dashboard' && (!options?.method || options.method === 'GET')) {
    // Calculate dashboard stats
    const totalProducts = stockData.length;
    const lowStockCount = stockData.filter((product) => product.remaining_quantity <= product.min_stock).length;
    
    // Calculate near expiry count (within 30 days)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    
    const nearExpiryBatches = stockBatches.filter((batch) => {
      const expireDate = new Date(batch.expire_date);
      expireDate.setHours(0, 0, 0, 0);
      return expireDate >= today && expireDate <= thirtyDaysFromNow && batch.quantity > 0;
    });
    
    const nearExpiryCount = new Set(nearExpiryBatches.map((batch) => batch.barcode)).size;
    
    // Calculate total stock value (optional, using a simple average price)
    const averagePricePerUnit = 10; // Mock average price
    const totalStockValue = stockData.reduce((sum, product) => sum + (product.remaining_quantity * averagePricePerUnit), 0);
    
    mockData = {
      data: {
        total_products: totalProducts,
        low_stock_count: lowStockCount,
        near_expiry_count: nearExpiryCount,
        total_stock_value: totalStockValue,
      },
    };
    status = 200;
  } else if (pathname === '/api/stock/list' && (!options?.method || options.method === 'GET')) {
    // Get stock list with optional search
    const search = searchParams.get('search');
    
    let filteredProducts = [...stockData];
    
    // Apply search filter (product name or barcode)
    if (search) {
      const searchLower = search.toLowerCase();
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.product_name.toLowerCase().includes(searchLower) ||
          product.barcode.includes(search)
      );
    }
    
    // Sort by product name
    filteredProducts.sort((a, b) => a.product_name.localeCompare(b.product_name));
    
    mockData = {
      data: filteredProducts,
    };
    status = 200;
  } else if (pathname === '/api/stock/movements' && (!options?.method || options.method === 'GET')) {
    // Get stock movements with optional date filter, grouped by session_id
    const dateFilter = searchParams.get('filter') || 'today'; // 'today' or '7days'
    
    let filteredMovements = [...stockMovements];
    
    // Apply date filter
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    if (dateFilter === 'today') {
      // Filter to today only
      filteredMovements = filteredMovements.filter((movement) => {
        const movementDate = new Date(movement.created_at);
        movementDate.setHours(0, 0, 0, 0);
        return movementDate.getTime() === now.getTime();
      });
    } else if (dateFilter === '7days') {
      // Filter to last 7 days
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      filteredMovements = filteredMovements.filter((movement) => {
        const movementDate = new Date(movement.created_at);
        return movementDate >= sevenDaysAgo;
      });
    }
    
    // Group movements by session_id + product_name + type + created_at
    // For movements without session_id, group by id (each is its own group)
    interface GroupedMovement {
      session_id?: string;
      product_name: string;
      type: 'IN' | 'OUT';
      created_at: string;
      details: Array<{ lot: string; quantity: number }>;
      total_quantity: number;
    }
    
    const groupedMap = new Map<string, GroupedMovement>();
    
    for (const movement of filteredMovements) {
      // Create a key for grouping
      // For bulk operations (with session_id), group by session + product + type + timestamp
      // For single operations (without session_id), use id to create individual groups
      const groupKey = movement.session_id
        ? `${movement.session_id}|${movement.product_name}|${movement.type}|${movement.created_at}`
        : movement.id;
      
      if (!groupedMap.has(groupKey)) {
        // Create new group
        groupedMap.set(groupKey, {
          session_id: movement.session_id,
          product_name: movement.product_name,
          type: movement.type,
          created_at: movement.created_at,
          details: [],
          total_quantity: 0,
        });
      }
      
      const group = groupedMap.get(groupKey)!;
      
      // Add lot detail
      if (movement.lot_number) {
        // Check if lot already exists in details
        const existingLotIndex = group.details.findIndex((d) => d.lot === movement.lot_number);
        if (existingLotIndex !== -1) {
          group.details[existingLotIndex].quantity += movement.quantity;
        } else {
          group.details.push({
            lot: movement.lot_number,
            quantity: movement.quantity,
          });
        }
      } else {
        // For movements without lot_number, add a generic entry
        const existingNaIndex = group.details.findIndex((d) => d.lot === 'N/A');
        if (existingNaIndex !== -1) {
          group.details[existingNaIndex].quantity += movement.quantity;
        } else {
          group.details.push({
            lot: 'N/A',
            quantity: movement.quantity,
          });
        }
      }
      
      group.total_quantity += movement.quantity;
    }
    
    // Convert map to array and sort by created_at descending (newest first)
    const groupedArray = Array.from(groupedMap.values()).sort((a, b) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    
    // Format response to match API spec (remove total_quantity, it's calculated from details)
    const formattedResponse = groupedArray.map((group) => ({
      session_id: group.session_id,
      product_name: group.product_name,
      type: group.type,
      created_at: group.created_at,
      details: group.details,
    }));
    
    mockData = {
      data: formattedResponse,
    };
    status = 200;
  } else if (pathname === '/api/v1/appointments/today') {
    mockData = { data: appointmentsData };
  } else if (pathname === '/api/v1/patients') {
    // Handle search and pagination for patients
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    
    let filteredData = [...patientsData];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filteredData = filteredData.filter(
        (patient) =>
          patient.fullName.toLowerCase().includes(searchLower) ||
          patient.phone.includes(search) ||
          (patient.nationalId && patient.nationalId.includes(search))
      );
    }
    
    // Simple pagination (10 items per page)
    const itemsPerPage = 10;
    const startIndex = (page - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    mockData = {
      data: paginatedData,
      page,
      totalPages,
      total: filteredData.length,
    };
  } else if (pathname.startsWith('/api/v1/appointments/') && pathname.endsWith('/status') && options?.method === 'PATCH') {
    // Mock status update - update the appointment in mock data
    const appointmentId = pathname.split('/')[4];
    const body = JSON.parse(options.body as string);
    const newStatus = body.status;
    
    // Find and update the appointment
    const appointmentIndex = appointmentsData.findIndex((apt: any) => apt.id === appointmentId);
    if (appointmentIndex !== -1) {
      appointmentsData[appointmentIndex] = {
        ...appointmentsData[appointmentIndex],
        status: newStatus,
      };
      mockData = {
        id: appointmentId,
        status: newStatus,
        message: 'Status updated successfully',
      };
    } else {
      status = 404;
      mockData = {
        message: 'Appointment not found',
      };
    }
  } else if (pathname === '/api/v1/patients' && options?.method === 'POST') {
    // Mock patient creation - add to mock data
    const body = JSON.parse(options.body as string);
    const newPatient = {
      id: `pat-${Date.now()}`,
      fullName: `${body.firstName} ${body.lastName}`,
      phone: body.phone,
      nationalId: body.nationalId || null,
      createdAt: new Date().toISOString(),
    };
    patientsData.push(newPatient);
    mockData = newPatient;
    status = 201;
  } else if (pathname === '/api/stock/product' && options?.method === 'GET') {
    // Mock get product info by barcode (without deducting)
    const barcode = searchParams.get('barcode');
    
    if (!barcode) {
      status = 400;
      mockData = {
        message: 'Barcode is required',
      };
    } else {
      const product = stockData.find((p) => p.barcode === barcode);
      
      if (!product) {
        status = 404;
        mockData = {
          message: 'Product not found',
        };
      } else {
        mockData = {
          product_name: product.product_name,
          remaining_quantity: product.remaining_quantity,
        };
        status = 200;
      }
    }
  } else if (pathname === '/api/stock/in' && options?.method === 'POST') {
    // Mock stock in - add quantity to product
    const body = JSON.parse(options.body as string);
    const { barcode, quantity, lot, expire_date } = body;
    
    if (!barcode) {
      status = 400;
      mockData = {
        message: 'Barcode is required',
      };
    } else if (!quantity || quantity <= 0) {
      status = 400;
      mockData = {
        message: 'Quantity must be greater than 0',
      };
    } else if (!lot) {
      status = 400;
      mockData = {
        message: 'Lot number is required',
      };
    } else if (!expire_date) {
      status = 400;
      mockData = {
        message: 'Expire date is required',
      };
    } else {
      // Validate expire date is in the future
      const expireDate = new Date(expire_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      expireDate.setHours(0, 0, 0, 0);

      if (expireDate <= today) {
        status = 400;
        mockData = {
          message: 'Expire date must be in the future',
        };
      } else {
        let productIndex = stockData.findIndex((product) => product.barcode === barcode);
        
        if (productIndex === -1) {
          // Create new product if it doesn't exist
          const newProduct = {
            barcode: barcode,
            product_name: `Product ${barcode}`, // In real system, this would come from product lookup
            remaining_quantity: quantity,
            min_stock: 10, // Default min_stock for new products
            unit: 'piece', // Default unit for new products
          };
          stockData.push(newProduct);
          productIndex = stockData.length - 1;
        } else {
          // Add to existing product
          stockData[productIndex] = {
            ...stockData[productIndex],
            remaining_quantity: stockData[productIndex].remaining_quantity + quantity,
          };
        }
        
        // Add batch record for expiry tracking
        stockBatches.push({
          id: `batch-${Date.now()}`,
          barcode: barcode,
          lot: lot,
          expire_date: expire_date,
          quantity: quantity,
        });
        
        const product = stockData[productIndex];
        
        // Add movement record for stock IN
        stockMovements.unshift({
          id: `mov-${Date.now()}`,
          barcode: barcode,
          product_name: product.product_name,
          type: 'IN',
          quantity: quantity,
          created_at: new Date().toISOString(),
        });
        mockData = {
          id: `batch-${Date.now()}`,
          barcode: product.barcode,
          product_name: product.product_name,
          quantity: quantity,
          lot: lot,
          expire_date: expire_date,
          message: 'Stock added successfully',
        };
        status = 201;
      }
    }
  } else if (pathname === '/api/stock/out' && options?.method === 'POST') {
    // Mock stock out - deduct quantity from product
    const body = JSON.parse(options.body as string);
    const { barcode, quantity = 1 } = body;
    
    if (!barcode) {
      status = 400;
      mockData = {
        message: 'Barcode is required',
      };
    } else {
      const productIndex = stockData.findIndex((product) => product.barcode === barcode);
      
      if (productIndex === -1) {
        status = 404;
        mockData = {
          message: 'Product not found',
        };
      } else {
        const product = stockData[productIndex];
        const newQuantity = product.remaining_quantity - quantity;
        
        // Update stock quantity (allow negative for testing error states)
        stockData[productIndex] = {
          ...product,
          remaining_quantity: newQuantity,
        };
        
        // Add movement record for stock OUT
        stockMovements.unshift({
          id: `mov-${Date.now()}`,
          barcode: barcode,
          product_name: product.product_name,
          type: 'OUT',
          quantity: quantity,
          created_at: new Date().toISOString(),
        });
        
        mockData = {
          product_name: product.product_name,
          remaining_quantity: newQuantity,
        };
        status = 200;
      }
    }
  } else if (pathname === '/api/stock/in/bulk' && options?.method === 'POST') {
    // Mock bulk stock in - add multiple items at once
    const body = JSON.parse(options.body as string);
    const { items } = body;
    
    if (!Array.isArray(items) || items.length === 0) {
      status = 400;
      mockData = {
        message: 'Items array is required and must not be empty',
      };
    } else {
      const results: any[] = [];
      const errors: string[] = [];
      // Generate session ID for this bulk operation
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      for (const item of items) {
        const { barcode, quantity, lot, expire_date } = item;
        
        if (!barcode || !quantity || !lot || !expire_date) {
          errors.push(`Item with barcode ${barcode || 'unknown'} is missing required fields`);
          continue;
        }
        
        // Validate expire date is in the future
        const expireDate = new Date(expire_date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        expireDate.setHours(0, 0, 0, 0);
        
        if (expireDate <= today) {
          errors.push(`Item ${barcode} has invalid expire date (must be in future)`);
          continue;
        }
        
        // Find or create product
        let productIndex = stockData.findIndex((product) => product.barcode === barcode);
        
        if (productIndex === -1) {
          // Create new product (default values)
          const newProduct: MockProduct = {
            barcode: barcode,
            product_name: `Product ${barcode}`,
            remaining_quantity: 0,
            min_stock: 5,
            unit: 'unit',
          };
          stockData.push(newProduct);
          productIndex = stockData.length - 1;
        }
        
        const product = stockData[productIndex];
        
        // Update stock quantity
        stockData[productIndex] = {
          ...product,
          remaining_quantity: product.remaining_quantity + quantity,
        };
        
        // Add batch record
        stockBatches.push({
          id: `batch-${Date.now()}-${Math.random()}`,
          barcode: barcode,
          lot: lot,
          expire_date: expire_date,
          quantity: quantity,
        });
        
        // Add movement record with lot_number and session_id
        stockMovements.unshift({
          id: `mov-${Date.now()}-${Math.random()}`,
          barcode: barcode,
          product_name: product.product_name,
          type: 'IN',
          quantity: quantity,
          lot_number: lot,
          session_id: sessionId,
          created_at: timestamp,
        });
        
        results.push({
          barcode,
          product_name: product.product_name,
          quantity,
          remaining_quantity: stockData[productIndex].remaining_quantity,
        });
      }
      
      if (errors.length > 0) {
        status = 400;
        mockData = {
          message: 'Some items failed to process',
          errors,
          results,
        };
      } else {
        mockData = {
          success: true,
          message: `${results.length} item(s) added successfully`,
          results,
        };
        status = 200;
      }
    }
  } else if (pathname === '/api/stock/out/bulk' && options?.method === 'POST') {
    // Mock bulk stock out - deduct multiple items at once
    const body = JSON.parse(options.body as string);
    const { items } = body;
    
    if (!Array.isArray(items) || items.length === 0) {
      status = 400;
      mockData = {
        message: 'Items array is required and must not be empty',
      };
    } else {
      const results: any[] = [];
      const errors: string[] = [];
      // Generate session ID for this bulk operation
      const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();
      
      for (const item of items) {
        const { barcode, quantity } = item;
        
        if (!barcode || !quantity) {
          errors.push(`Item with barcode ${barcode || 'unknown'} is missing required fields`);
          continue;
        }
        
        const productIndex = stockData.findIndex((product) => product.barcode === barcode);
        
        if (productIndex === -1) {
          errors.push(`Product with barcode ${barcode} not found`);
          continue;
        }
        
        const product = stockData[productIndex];
        
        if (product.remaining_quantity < quantity) {
          errors.push(`Insufficient stock for ${product.product_name}. Available: ${product.remaining_quantity}, Requested: ${quantity}`);
          continue;
        }
        
        // Simulate FIFO lot selection - find batches for this product and use oldest first
        const productBatches = stockBatches
          .filter((batch) => batch.barcode === barcode && batch.quantity > 0)
          .sort((a, b) => new Date(a.expire_date).getTime() - new Date(b.expire_date).getTime());
        
        let remainingQty = quantity;
        const lotUsages: Array<{ lot: string; quantity: number }> = [];
        
        // Use FIFO to deduct from batches and track lot usage
        for (const batch of productBatches) {
          if (remainingQty <= 0) break;
          
          const deductFromBatch = Math.min(remainingQty, batch.quantity);
          batch.quantity -= deductFromBatch;
          remainingQty -= deductFromBatch;
          
          // Track lot usage
          lotUsages.push({
            lot: batch.lot,
            quantity: deductFromBatch,
          });
        }
        
        // Update stock quantity
        const newQuantity = product.remaining_quantity - quantity;
        stockData[productIndex] = {
          ...product,
          remaining_quantity: newQuantity,
        };
        
        // Create movement records for each lot used (or one record if no lots tracked)
        if (lotUsages.length > 0) {
          for (const lotUsage of lotUsages) {
            stockMovements.unshift({
              id: `mov-${Date.now()}-${Math.random()}`,
              barcode: barcode,
              product_name: product.product_name,
              type: 'OUT',
              quantity: lotUsage.quantity,
              lot_number: lotUsage.lot,
              session_id: sessionId,
              created_at: timestamp,
            });
          }
        } else {
          // Fallback: create one movement record without lot_number
          stockMovements.unshift({
            id: `mov-${Date.now()}-${Math.random()}`,
            barcode: barcode,
            product_name: product.product_name,
            type: 'OUT',
            quantity: quantity,
            session_id: sessionId,
            created_at: timestamp,
          });
        }
        
        results.push({
          barcode,
          product_name: product.product_name,
          quantity,
          remaining_quantity: newQuantity,
        });
      }
      
      if (errors.length > 0) {
        status = 400;
        mockData = {
          message: 'Some items failed to process',
          errors,
          results,
        };
      } else {
        mockData = {
          success: true,
          message: `${results.length} item(s) used successfully`,
          results,
        };
        status = 200;
      }
    }
  } else {
    // Unknown endpoint - return 404
    status = 404;
    mockData = {
      message: 'Mock endpoint not found',
      path: pathname,
    };
  }

  // Create a mock Response object
  return new Response(JSON.stringify(mockData), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Enhanced fetch that uses mock data when enabled
 */
export async function apiFetch(url: string, options?: RequestInit): Promise<Response> {
  if (shouldUseMock()) {
    return mockFetch(url, options);
  }
  return fetch(url, options);
}

/**
 * Enable mock API (stores in localStorage)
 */
export function enableMockApi() {
  if (typeof window !== 'undefined') {
    localStorage.setItem('USE_MOCK_API', 'true');
    console.log('✅ Mock API enabled. Refresh the page to use mock data.');
  }
}

/**
 * Disable mock API
 */
export function disableMockApi() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('USE_MOCK_API');
    console.log('✅ Mock API disabled. Refresh the page to use real API.');
  }
}

