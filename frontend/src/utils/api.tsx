// src/lib/api.ts
import axios from 'axios';
import { getAuthToken, getRefreshToken, saveAuthToken, saveRefreshToken, logout } from '../utils/auth';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

// Request Interceptor → attach access token
api.interceptors.request.use(cfg => {
  const token = getAuthToken();
  if (token) {
    cfg.headers = cfg.headers || {};
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Response Interceptor → handle expired token
api.interceptors.response.use(
  res => res,
  async err => {
    const originalReq = err.config;

    // Prevent infinite loops
    if (err.response?.status === 401 && !originalReq._retry) {
      originalReq._retry = true;

      try {
        const refreshRes = await axios.post('/auth/refresh', {
          refreshToken: getRefreshToken()
        });

        const { accessToken, refreshToken } = refreshRes.data;
        saveAuthToken(accessToken);
        saveRefreshToken(refreshToken);

        originalReq.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalReq); // Retry the original request
      } catch (refreshError) {
        logout();
        window.location.href = '/login'; // Redirect to login
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(err);
  }
);

export default api;
