import axios from 'axios';

/**
 * Centralized API client using Axios
 * Configured with base URL from environment variable
 */
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    "x-api-key": import.meta.env.VITE_API_KEY || '',
  },
});

export default apiClient;

