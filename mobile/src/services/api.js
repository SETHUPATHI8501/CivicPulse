import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Default LAN Backend URL for Physical Android Devices on the Hackathon Network
const DEFAULT_LAN_API_URL = 'http://10.46.101.115:8000/api/v1';
const CUSTOM_API_URL_KEY = 'civicpulse_custom_api_url';

// Determine the default backend base URL based on environment & platform
const getDefaultBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }
  if (Platform.OS === 'android') {
    return DEFAULT_LAN_API_URL;
  }
  return 'http://localhost:8000/api/v1';
};

export let API_BASE_URL = getDefaultBaseUrl();

export const setCustomApiBaseUrl = async (newUrl) => {
  const cleaned = (newUrl || '').trim().replace(/\/+$/, '');
  if (!cleaned) {
    await AsyncStorage.removeItem(CUSTOM_API_URL_KEY);
    API_BASE_URL = getDefaultBaseUrl();
  } else {
    const normalized = cleaned.endsWith('/api/v1') ? cleaned : `${cleaned}/api/v1`;
    await AsyncStorage.setItem(CUSTOM_API_URL_KEY, normalized);
    API_BASE_URL = normalized;
  }
  apiClient.defaults.baseURL = API_BASE_URL;
  return API_BASE_URL;
};

// Safe token retrieval supporting SecureStore on native with AsyncStorage fallback
const AUTH_TOKEN_KEY = 'civicpulse_auth_token';

export const getStoredToken = async () => {
  try {
    if (Platform.OS !== 'web') {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        return await SecureStore.getItemAsync(AUTH_TOKEN_KEY);
      }
    }
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (err) {
    console.warn('Error reading stored auth token:', err);
    return null;
  }
};

export const setStoredToken = async (token) => {
  try {
    if (Platform.OS !== 'web') {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.setItemAsync(AUTH_TOKEN_KEY, token);
        return;
      }
    }
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (err) {
    console.warn('Error saving auth token:', err);
  }
};

export const removeStoredToken = async () => {
  try {
    if (Platform.OS !== 'web') {
      const isAvailable = await SecureStore.isAvailableAsync();
      if (isAvailable) {
        await SecureStore.deleteItemAsync(AUTH_TOKEN_KEY);
        return;
      }
    }
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (err) {
    console.warn('Error removing auth token:', err);
  }
};

// Create Axios Instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach Bearer Token, apply any custom LAN URL override, and handle FormData
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const customUrl = await AsyncStorage.getItem(CUSTOM_API_URL_KEY);
      if (customUrl) {
        API_BASE_URL = customUrl;
        config.baseURL = customUrl;
      }
    } catch {
      // Ignore storage read error
    }

    try {
      const token = await getStoredToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Continue without token if retrieval fails
    }

    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Format userMessage for UI display
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    let message = 'An unexpected error occurred. Please try again.';

    if (error.response) {
      const detail = error.response.data?.detail;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.map((e) => e.msg || e.message).join(', ');
      } else if (error.response.status === 401) {
        message = 'Invalid credentials or session expired.';
      } else if (error.response.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (error.response.status === 404) {
        message = 'The requested resource was not found.';
      } else if (error.response.status >= 500) {
        message = 'Municipal server encountered an error. Please try again shortly.';
      }
    } else if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      message = 'Request timed out. Please check your network connection.';
    } else if (error.request) {
      message = `Cannot reach backend server at ${API_BASE_URL}. Ensure FastAPI is running on the host LAN IP (--host 0.0.0.0 --port 8000).`;
    }

    error.userMessage = message;
    return Promise.reject(error);
  }
);

export const getMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  const baseRoot = API_BASE_URL.replace(/\/api\/v1\/?$/, '');
  const cleanPath = path.replace(/^\/+/, '');
  return `${baseRoot}/${cleanPath}`;
};

export const connectLiveUpdates = (onEvent) => {
  if (typeof WebSocket === 'undefined') {
    return () => {};
  }

  let ws = null;
  let closed = false;
  let reconnectTimer = null;

  const connect = () => {
    if (closed) return;
    try {
      const wsUrl = `${API_BASE_URL.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/updates`;
      ws = new WebSocket(wsUrl);
      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload && payload.event && payload.event !== 'PONG' && onEvent) {
            onEvent(payload);
          }
        } catch {
          // ignore malformed messages
        }
      };
      ws.onclose = () => {
        if (!closed) {
          reconnectTimer = setTimeout(connect, 5000);
        }
      };
      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // ignore
        }
      };
    } catch {
      if (!closed) {
        reconnectTimer = setTimeout(connect, 6000);
      }
    }
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      try {
        ws.close();
      } catch {
        // ignore
      }
    }
  };
};

export default apiClient;
