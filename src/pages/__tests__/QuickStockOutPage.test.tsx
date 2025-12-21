import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuickStockOutPage from '../QuickStockOutPage';
import { apiFetch } from '../../utils/mockApi';
import { enableMockApi } from '../../utils/mockApi';

// Mock @zxing/library
vi.mock('@zxing/library', () => {
  const mockReader = {
    listVideoInputDevices: vi.fn().mockResolvedValue([
      { deviceId: 'device1', label: 'Camera 1' },
    ]),
    decodeFromVideoDevice: vi.fn(),
    reset: vi.fn(),
  };

  return {
    BrowserMultiFormatReader: vi.fn().mockImplementation(() => mockReader),
  };
});

// Mock apiFetch
vi.mock('../../utils/mockApi', async () => {
  const actual = await vi.importActual('../../utils/mockApi');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('QuickStockOutPage', () => {
  beforeEach(() => {
    enableMockApi();
    vi.clearAllMocks();
    
    // Mock getUserMedia
    global.navigator.mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue({
        getTracks: () => [{ stop: vi.fn() }],
      }),
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when page loads', () => {
    it('should start camera scanning automatically', async () => {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      
      render(<QuickStockOutPage />);

      await waitFor(() => {
        expect(BrowserMultiFormatReader).toHaveBeenCalled();
      });
    });
  });

  describe('when barcode is detected', () => {
    it('should call API to fetch product information', async () => {
      const mockProductData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 25,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '1234567890123',
          }, null);
        }
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/stock/product?barcode=1234567890123',
          { method: 'GET' }
        );
      });
    });

    it('should display product name and remaining quantity', async () => {
      const mockProductData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 25,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '1234567890123',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Dental Floss 50m')).toBeInTheDocument();
        expect(screen.getByText('25')).toBeInTheDocument();
      });
    });

    it('should show error when stock is insufficient', async () => {
      const mockProductData = {
        product_name: 'Dental Paste',
        remaining_quantity: 0,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '4567890123456',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Stock is insufficient/i)).toBeInTheDocument();
      });
    });

    it('should show error message when API call fails', async () => {
      (apiFetch as any).mockRejectedValueOnce(new Error('Network error'));

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '1234567890123',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText(/Network error/i)).toBeInTheDocument();
      });
    });
  });

  describe('when Use Item button is clicked', () => {
    it('should call API to deduct stock', async () => {
      const mockProductData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 25,
      };

      const mockUpdatedData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 24,
      };

      // First call for product info
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      // Second call for stock deduction
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockUpdatedData,
      });

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '1234567890123',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Use Item')).toBeInTheDocument();
      });

      const useItemButton = screen.getByText('Use Item');
      const user = userEvent.setup();

      await act(async () => {
        await user.click(useItemButton);
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/stock/out',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              barcode: '1234567890123',
              quantity: 1,
            }),
          })
        );
      });
    });

    it('should show success feedback for 500ms after successful stock deduction', async () => {
      const mockProductData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 25,
      };

      const mockUpdatedData = {
        product_name: 'Dental Floss 50m',
        remaining_quantity: 24,
      };

      // First call for product info
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      // Second call for stock deduction
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockUpdatedData,
      });

      vi.useFakeTimers();

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '1234567890123',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Use Item')).toBeInTheDocument();
      });

      const useItemButton = screen.getByText('Use Item');
      const user = userEvent.setup();

      await act(async () => {
        await user.click(useItemButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Stock deducted successfully/i)).toBeInTheDocument();
      });

      // Advance time by 500ms
      act(() => {
        vi.advanceTimersByTime(500);
      });

      await waitFor(() => {
        expect(screen.queryByText(/Stock deducted successfully/i)).not.toBeInTheDocument();
      }, { timeout: 100 });

      vi.useRealTimers();
    });

    it('should show error when stock becomes insufficient after deduction', async () => {
      const mockProductData = {
        product_name: 'Dental Paste',
        remaining_quantity: 1,
      };

      const mockUpdatedData = {
        product_name: 'Dental Paste',
        remaining_quantity: 0,
      };

      // First call for product info
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockProductData,
      });

      // Second call for stock deduction
      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockUpdatedData,
      });

      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<QuickStockOutPage />);

      // Simulate barcode detection
      await act(async () => {
        const decodeCallback = mockReader.decodeFromVideoDevice.mock.calls[0]?.[2];
        if (decodeCallback) {
          decodeCallback({
            getText: () => '4567890123456',
          }, null);
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Use Item')).toBeInTheDocument();
      });

      const useItemButton = screen.getByText('Use Item');
      const user = userEvent.setup();

      await act(async () => {
        await user.click(useItemButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/Stock is insufficient/i)).toBeInTheDocument();
      });
    });
  });
});

