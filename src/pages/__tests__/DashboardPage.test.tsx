import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import DashboardPage from '../DashboardPage';
import { apiFetch } from '../../utils/mockApi';
import { enableMockApi } from '../../utils/mockApi';

// Mock apiFetch
vi.mock('../../utils/mockApi', async () => {
  const actual = await vi.importActual('../../utils/mockApi');
  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    enableMockApi();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('when page loads', () => {
    it('should fetch dashboard stats from API', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 2,
        near_expiry_count: 1,
        total_stock_value: 980,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledWith('/api/stock/dashboard');
      });
    });

    it('should display loading state while fetching', () => {
      (apiFetch as any).mockImplementationOnce(() => new Promise(() => {})); // Never resolves

      render(<DashboardPage />);

      expect(screen.getByText(/loading dashboard/i)).toBeInTheDocument();
    });
  });

  describe('stat cards display', () => {
    it('should display all stat cards with correct values', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 2,
        near_expiry_count: 1,
        total_stock_value: 980,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('Total Products')).toBeInTheDocument();
        expect(screen.getByText('5')).toBeInTheDocument();
        expect(screen.getByText('Low Stock')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Near Expiry')).toBeInTheDocument();
        expect(screen.getByText('1')).toBeInTheDocument();
        expect(screen.getByText('Total Stock Value')).toBeInTheDocument();
        expect(screen.getByText('$980')).toBeInTheDocument();
      });
    });

    it('should highlight low stock count in red when greater than 0', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 2,
        near_expiry_count: 0,
        total_stock_value: 980,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        const lowStockCard = screen.getByText('Low Stock').closest('div');
        expect(lowStockCard).toHaveClass('bg-red-50', 'border-red-300');
      });
    });

    it('should highlight near expiry count in yellow when greater than 0', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 0,
        near_expiry_count: 3,
        total_stock_value: 980,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        const nearExpiryCard = screen.getByText('Near Expiry').closest('div');
        expect(nearExpiryCard).toHaveClass('bg-yellow-50', 'border-yellow-300');
      });
    });

    it('should display normal styling when counts are 0', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 0,
        near_expiry_count: 0,
        total_stock_value: 980,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        const lowStockCard = screen.getByText('Low Stock').closest('div');
        expect(lowStockCard).toHaveClass('bg-white', 'border-gray-200');
        
        const nearExpiryCard = screen.getByText('Near Expiry').closest('div');
        expect(nearExpiryCard).toHaveClass('bg-white', 'border-gray-200');
      });
    });
  });

  describe('error handling', () => {
    it('should display error message when API call fails', async () => {
      (apiFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ message: 'Server error' }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText(/server error/i)).toBeInTheDocument();
      });
    });

    it('should display retry button when error occurs', async () => {
      (apiFetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ message: 'Server error' }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });
    });

    it('should retry fetching when retry button is clicked', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 0,
        near_expiry_count: 0,
        total_stock_value: 980,
      };

      // First call fails
      (apiFetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ message: 'Server error' }),
        })
        // Second call succeeds
        .mockResolvedValueOnce({
          ok: true,
          headers: {
            get: () => 'application/json',
          },
          json: async () => ({ data: mockStats }),
        });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /retry/i });
      retryButton.click();

      await waitFor(() => {
        expect(apiFetch).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('currency formatting', () => {
    it('should format total stock value as currency', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 0,
        near_expiry_count: 0,
        total_stock_value: 1234,
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.getByText('$1,234')).toBeInTheDocument();
      });
    });

    it('should handle optional total stock value field', async () => {
      const mockStats = {
        total_products: 5,
        low_stock_count: 0,
        near_expiry_count: 0,
        // total_stock_value is optional
      };

      (apiFetch as any).mockResolvedValueOnce({
        ok: true,
        headers: {
          get: () => 'application/json',
        },
        json: async () => ({ data: mockStats }),
      });

      render(<DashboardPage />);

      await waitFor(() => {
        expect(screen.queryByText('Total Stock Value')).not.toBeInTheDocument();
      });
    });
  });
});

