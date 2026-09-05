import axios, { AxiosRequestConfig, AxiosError } from 'axios'
import {
  getAuthToken,
  saveAuthToken,
  isTokenExpired,
  refreshAccessTokenIfNeeded,
  clearClientAuthState,
} from './auth'

interface AxiosRequestConfigWithRetry extends AxiosRequestConfig {
  _retry?: boolean
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let refreshing: Promise<string> | null = null

const PUBLIC_AUTH_PATHS = ['auth/login', 'auth/signup', 'auth/refresh']

const isPublicAuthRequest = (url?: string) => {
  if (!url) return false

  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path))
}

api.interceptors.request.use(
  async (config) => {
    if (import.meta.env.DEV) {
      console.debug('[api] request', config.method, config.url)
    }

    if (isPublicAuthRequest(config.url)) {
      return config
    }

    let token = getAuthToken()

    try {
      if (token && isTokenExpired(token)) {
        if (!refreshing) {
          refreshing = refreshAccessTokenIfNeeded().catch(err => {
            refreshing = null
            throw err
          })
        }
        token = await refreshing
      }
    } catch {
      refreshing = null
      clearClientAuthState()
      token = null
    }

    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (import.meta.env.DEV) {
      console.debug('[api] response error', error.code, error.response?.status, error.config?.url)
    }
    const original = error.config as AxiosRequestConfigWithRetry | undefined

    if (isPublicAuthRequest(original?.url)) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true

      try {
        if (!refreshing) {
          refreshing = refreshAccessTokenIfNeeded().catch(err => {
            refreshing = null
            throw err
          })
        }

        const newAccessToken = await refreshing
        refreshing = null

        if (newAccessToken) saveAuthToken(newAccessToken)

        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${newAccessToken}`

        return api(original)
      } catch (refreshErr) {
        refreshing = null
        clearClientAuthState()
        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
)

export default api
