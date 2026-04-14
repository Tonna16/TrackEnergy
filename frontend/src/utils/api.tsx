import axios, { AxiosRequestConfig, AxiosError } from 'axios'
import {
  getAuthToken,
  saveAuthToken,
  logout,
  isTokenExpired,
  refreshAccessTokenIfNeeded,
} from './auth'

interface AxiosRequestConfigWithRetry extends AxiosRequestConfig {
  _retry?: boolean
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
})

let refreshing: Promise<string> | null = null

api.interceptors.request.use(
  async (config) => {
    if (import.meta.env.MODE === 'development') {
      console.debug('[api] request', config.method, config.url)
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
    } catch (err) {
      refreshing = null
      logout()
      throw err
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
    const original = error.config as AxiosRequestConfigWithRetry | undefined

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
        logout()
        window.location.href = '/'
        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
)

export default api
