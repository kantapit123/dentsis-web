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
}

let stockData: MockProduct[] = [
  { barcode: '1234567890123', product_name: 'Dental Floss 50m', remaining_quantity: 25 },
  { barcode: '2345678901234', product_name: 'Toothbrush Soft', remaining_quantity: 15 },
  { barcode: '3456789012345', product_name: 'Mouthwash 500ml', remaining_quantity: 8 },
  { barcode: '4567890123456', product_name: 'Dental Paste', remaining_quantity: 0 },
  { barcode: '5678901234567', product_name: 'Gloves Medium', remaining_quantity: 50 },
];

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
  if (pathname === '/api/v1/appointments/today') {
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
        
        const product = stockData[productIndex];
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
        
        mockData = {
          product_name: product.product_name,
          remaining_quantity: newQuantity,
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

