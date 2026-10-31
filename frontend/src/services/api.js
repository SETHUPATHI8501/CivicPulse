import axios from 'axios';

const baseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1').replace(/\/+$/, '');

const api = axios.create({
  baseURL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: attach Bearer token and handle FormData
api.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('civicpulse_auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage access error ignored
    }

    // When submitting multipart FormData, let the browser/axios set boundary automatically
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for consistent error extraction and 401 handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected network error occurred.';
    if (error.response) {
      const data = error.response.data;
      if (typeof data === 'string') {
        message = data;
      } else if (data?.detail) {
        if (Array.isArray(data.detail)) {
          message = data.detail.map((d) => d.msg || `${d.loc?.join('.')}: ${d.type}`).join(', ');
        } else {
          message = String(data.detail);
        }
      } else if (data?.message) {
        message = data.message;
      }

      // If token expired/invalid on protected endpoint (and not during login), clear stored session
      if (error.response.status === 401 && !error.config.url.includes('/auth/token')) {
        try {
          localStorage.removeItem('civicpulse_auth_token');
          localStorage.removeItem('civicpulse_auth_user');
        } catch {
          // Ignored
        }
      }
    } else if (error.request) {
      message = 'Cannot connect to CivicPulse AI backend server. Please verify the server is running.';
    } else if (error.message) {
      message = error.message;
    }
    error.userMessage = message;
    return Promise.reject(error);
  }
);

export default api;
