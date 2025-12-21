import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockInPage from '../StockInPage';
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

describe('StockInPage', () => {
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

  describe('form rendering', () => {
    it('should render all form fields', () => {
      render(<StockInPage />);

      expect(screen.getByLabelText(/barcode/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/quantity/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/lot number/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/expire date/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /add stock/i })).toBeInTheDocument();
    });

    it('should render scan button', () => {
      render(<StockInPage />);

      expect(screen.getByRole('button', { name: /scan/i })).toBeInTheDocument();
    });
  });

  describe('form validation', () => {
    it('should validate barcode is required', async () => {
      const user = userEvent.setup();
      render(<StockInPage />);

      const submitButton = screen.getByRole('button', { name: /add stock/i });
      await act(async () => {
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/barcode is required/i)).toBeInTheDocument();
      });
    });

    it('should validate quantity is required and greater than 0', async () => {
      const user = userEvent.setup();
      render(<StockInPage />);

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '0');
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/quantity must be greater than 0/i)).toBeInTheDocument();
      });
    });

    it('should validate lot number is required', async () => {
      const user = userEvent.setup();
      render(<StockInPage />);

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/lot number is required/i)).toBeInTheDocument();
      });
    });

    it('should validate expire date is required', async () => {
      const user = userEvent.setup();
      render(<StockInPage />);

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.type(lotInput, 'LOT001');
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/expire date is required/i)).toBeInTheDocument();
      });
    });

    it('should validate expire date must be in the future', async () => {
      const user = userEvent.setup();
      render(<StockInPage />);

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      // Set expire date to today (should fail)
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, todayString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/expire date must be in the future/i)).toBeInTheDocument();
      });
    });
  });

  describe('barcode scanning', () => {
    it('should start scanning when scan button is clicked', async () => {
      const user = userEvent.setup();
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      
      render(<StockInPage />);

      const scanButton = screen.getByRole('button', { name: /scan/i });
      await act(async () => {
        await user.click(scanButton);
      });

      await waitFor(() => {
        expect(BrowserMultiFormatReader).toHaveBeenCalled();
      });
    });

    it('should populate barcode field when barcode is detected', async () => {
      const user = userEvent.setup();
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<StockInPage />);

      const scanButton = screen.getByRole('button', { name: /scan/i });
      await act(async () => {
        await user.click(scanButton);
      });

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
        const barcodeInput = screen.getByLabelText(/barcode/i) as HTMLInputElement;
        expect(barcodeInput.value).toBe('1234567890123');
      });
    });

    it('should stop scanning when stop button is clicked', async () => {
      const user = userEvent.setup();
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const mockReader = new BrowserMultiFormatReader() as any;

      render(<StockInPage />);

      const scanButton = screen.getByRole('button', { name: /scan/i });
      await act(async () => {
        await user.click(scanButton);
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /stop scan/i })).toBeInTheDocument();
      });

      const stopButton = screen.getByRole('button', { name: /stop scan/i });
      await act(async () => {
        await user.click(stopButton);
      });

      expect(mockReader.reset).toHaveBeenCalled();
    });
  });

  describe('form submission', () => {
    it('should call API with correct payload when form is valid', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        id: 'batch-123',
        barcode: '1234567890123',
        product_name: 'Dental Floss 50m',
        quantity: 10,
        lot: 'LOT001',
        expire_date: '2025-12-31',
        message: 'Stock added successfully',
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockResponse,
      });

      render(<StockInPage />);

      // Get tomorrow's date for expire date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, tomorrowString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith(
          '/api/stock/in',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              barcode: '1234567890123',
              quantity: 10,
              lot: 'LOT001',
              expire_date: tomorrowString,
            }),
          })
        );
      });
    });

    it('should show success message after successful submission', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        id: 'batch-123',
        barcode: '1234567890123',
        product_name: 'Dental Floss 50m',
        quantity: 10,
        lot: 'LOT001',
        expire_date: '2025-12-31',
        message: 'Stock added successfully',
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockResponse,
      });

      render(<StockInPage />);

      // Get tomorrow's date for expire date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, tomorrowString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/stock added successfully/i)).toBeInTheDocument();
      });
    });

    it('should reset form after successful submission', async () => {
      const user = userEvent.setup();
      const mockResponse = {
        id: 'batch-123',
        barcode: '1234567890123',
        product_name: 'Dental Floss 50m',
        quantity: 10,
        lot: 'LOT001',
        expire_date: '2025-12-31',
        message: 'Stock added successfully',
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: {
          get: () => 'application/json',
        },
        json: async () => mockResponse,
      });

      render(<StockInPage />);

      // Get tomorrow's date for expire date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, tomorrowString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        const barcodeInputAfter = screen.getByLabelText(/barcode/i) as HTMLInputElement;
        expect(barcodeInputAfter.value).toBe('');
      });
    });

    it('should show error message when API call fails', async () => {
      const user = userEvent.setup();
      (apiFetch as any).mockRejectedValueOnce(new Error('Network error'));

      render(<StockInPage />);

      // Get tomorrow's date for expire date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, tomorrowString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument();
      });
    });

    it('should disable form fields and submit button while submitting', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (apiFetch as any).mockReturnValueOnce(pendingPromise);

      render(<StockInPage />);

      // Get tomorrow's date for expire date
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowString = tomorrow.toISOString().split('T')[0];

      const barcodeInput = screen.getByLabelText(/barcode/i);
      const quantityInput = screen.getByLabelText(/quantity/i);
      const lotInput = screen.getByLabelText(/lot number/i);
      const expireDateInput = screen.getByLabelText(/expire date/i);
      const submitButton = screen.getByRole('button', { name: /add stock/i });

      await act(async () => {
        await user.type(barcodeInput, '1234567890123');
        await user.clear(quantityInput);
        await user.type(quantityInput, '10');
        await user.type(lotInput, 'LOT001');
        await user.type(expireDateInput, tomorrowString);
        await user.click(submitButton);
      });

      await waitFor(() => {
        expect(submitButton).toBeDisabled();
        expect(barcodeInput).toBeDisabled();
        expect(quantityInput).toBeDisabled();
        expect(lotInput).toBeDisabled();
        expect(expireDateInput).toBeDisabled();
      });

      // Resolve the promise to clean up
      resolvePromise!({
        ok: true,
        status: 201,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({}),
      });
    });
  });
});

