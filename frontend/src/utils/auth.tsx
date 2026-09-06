import { jwtDecode } from 'jwt-decode'
import { BACKEND_ENABLED } from '../config/runtime'

export const getAuthToken = () => BACKEND_ENABLED ? localStorage.getItem('accessToken') : null

async function loadAxios() {
  if (!BACKEND_ENABLED) throw new Error('Accounts require local full-stack mode.')
  return (await import('axios')).default
}

export const saveAuthToken = (token: string) => {
  localStorage.setItem('accessToken', token)
}

export const saveUser = (user: unknown) => {
  localStorage.setItem('user', JSON.stringify(user))
}

export const getUser = (): unknown | null => {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export const getCookie = (name: string): string | null => {
  const prefix = `${name}=`
  const parts = document.cookie.split(';').map(v => v.trim())
  const match = parts.find(v => v.startsWith(prefix))
  return match ? decodeURIComponent(match.substring(prefix.length)) : null
}

export const getCsrfToken = () => getCookie('csrfToken')

export const clearClientAuthState = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('user')
  localStorage.setItem('appMode', 'simulated')
}

export const logout = () => {
  if (!BACKEND_ENABLED) return
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    void loadAxios().then(axios => axios.post('/api/auth/logout', {}, {
      withCredentials: true,
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    })).catch(() => undefined)
  }

  clearClientAuthState()
  sessionStorage.clear()
  window.location.href = '/'
}

export function isTokenExpired(token: string): boolean {
  if (!BACKEND_ENABLED) return true
  try {
    const { exp } = jwtDecode<{ exp: number }>(token)
    return exp * 1000 < Date.now()
  } catch {
    return true
  }
}

export async function refreshAccessTokenIfNeeded(): Promise<string> {
  if (!BACKEND_ENABLED) throw new Error('Accounts require local full-stack mode.')
  const accessToken = getAuthToken()

  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken
  }

  const csrfToken = getCsrfToken()
  if (!csrfToken) {
    clearClientAuthState()
    throw new Error('No CSRF token available for refresh')
  }

  const axios = await loadAxios()
  const response = await axios.post('/api/auth/refresh', {}, {
    withCredentials: true,
    headers: {
      'X-CSRF-Token': csrfToken,
    },
  })
  const newAccessToken = response.data.accessToken

  saveAuthToken(newAccessToken)

  return newAccessToken
}
