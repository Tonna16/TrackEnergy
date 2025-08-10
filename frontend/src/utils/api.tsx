import axios, { AxiosRequestConfig, AxiosError } from 'axios'
import {
  getAuthToken,
  getRefreshToken,
  saveAuthToken,
  saveRefreshToken,
  logout,
} from '../utils/auth'

interface AxiosRequestConfigWithRetry extends AxiosRequestConfig {
  _retry?: boolean
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: false, // Set true if backend requires cookies for refresh
})

// src/utils/api.tsx (or api.tsx)
api.interceptors.request.use(config => {
  // Only log in development and do NOT print the token value.
  if (import.meta.env.MODE === 'development') {
    // show which endpoint is being called to help debug loops without exposing token
    console.debug('[api] request', config.method, config.url);
  }

  const token = getAuthToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


api.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfigWithRetry

    if (
      error.response?.status === 401 &&
      !original._retry &&
      getRefreshToken()
    ) {
      original._retry = true

      if (original.url?.includes('/auth/refresh')) {
        logout()
        // Consider emitting an event or state change here instead of reload
        window.location.href = '/'
        return Promise.reject(error)
      }

      try {
        const r = await axios.post('/api/auth/refresh', {
          refreshToken: getRefreshToken(),
        })

        saveAuthToken(r.data.accessToken)
        saveRefreshToken(r.data.refreshToken)

        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${r.data.accessToken}`

        return api(original)
      } catch (refreshError) {
        logout()
        window.location.href = '/'
        return Promise.reject(refreshError)
      }
    }

    return Promise.reject(error)
  }
)

export default api
