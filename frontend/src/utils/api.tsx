import axios, { AxiosRequestConfig, AxiosError } from 'axios'
import {
  getAuthToken,
  getRefreshToken,
  saveAuthToken,
  saveRefreshToken,
  logout,
  isTokenExpired,
  refreshAccessTokenIfNeeded,
} from './auth' // adjust path if your file path differs

interface AxiosRequestConfigWithRetry extends AxiosRequestConfig {
  _retry?: boolean
}

const api = axios.create({
  baseURL: '/api',
  withCredentials: false,
})

// Shared promise for a currently-running refresh call.
// This serializes refreshes so parallel requests don't race.
let refreshing: Promise<string> | null = null

// Request interceptor: proactively refresh expired token (and wait for it) before sending requests.
api.interceptors.request.use(
  async (config) => {
    if (import.meta.env.MODE === 'development') {
      console.debug('[api] request', config.method, config.url)
    }

    let token = getAuthToken()

    try {
      // If token exists and is expired, attempt to refresh BEFORE sending the request.
      if (token && isTokenExpired(token) && getRefreshToken()) {
        if (!refreshing) {
          // start a refresh and keep the promise
          refreshing = refreshAccessTokenIfNeeded().catch(err => {
            // Ensure we clear refreshing on failure so subsequent attempts can run
            refreshing = null
            throw err
          })
        }
        // wait for the refresh to complete
        token = await refreshing
        // refreshAccessTokenIfNeeded already saves tokens, but ensure header uses fresh token
      }
    } catch (err) {
      // If refresh failed here, clear tokens and rethrow (requests should fail / user will be logged out)
      refreshing = null
      logout()
      throw err
    } finally {
      // reset if the promise resolved (we'll clear in response handling too)
      if (refreshing) {
        // don't clear here; let the refresh promise chain clear itself when it rejects.
      }
    }

    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor: on 401 attempt refresh once and retry the original request.
// Also, if a refresh is already in progress, wait for it and then retry.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfigWithRetry | undefined

    // only handle real responses with 401
    if (error.response?.status === 401 && original && !original._retry && getRefreshToken()) {
      original._retry = true

      try {
        // if a refresh is already in progress, wait for it
        if (!refreshing) {
          refreshing = refreshAccessTokenIfNeeded().catch(err => {
            refreshing = null
            throw err
          })
        }
        const newAccessToken = await refreshing
        // clear the shared promise now that it's resolved
        refreshing = null

        // save tokens (refreshAccessTokenIfNeeded already saves, but keep in sync)
        if (newAccessToken) saveAuthToken(newAccessToken)

        // attach new token and retry
        original.headers = original.headers ?? {}
        original.headers.Authorization = `Bearer ${newAccessToken}`

        return api(original)
      } catch (refreshErr) {
        // refresh failed — force logout and redirect
        refreshing = null
        logout()
        // Optionally redirect explicitly here:
        window.location.href = '/'
        return Promise.reject(refreshErr)
      }
    }

    return Promise.reject(error)
  }
)

export default api
