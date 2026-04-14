import { jwtDecode } from 'jwt-decode'
import axios from 'axios'

export const getAuthToken = () => localStorage.getItem('accessToken')

export const saveAuthToken = (token: string) => {
  localStorage.setItem('accessToken', token)
}

export const saveUser = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user))
}

export const getUser = (): any | null => {
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
}

export const logout = () => {
  const csrfToken = getCsrfToken()
  if (csrfToken) {
    void axios.post('/api/auth/logout', {}, {
      withCredentials: true,
      headers: {
        'X-CSRF-Token': csrfToken,
      },
    })
  }

  clearClientAuthState()
  sessionStorage.clear()
  window.location.href = '/'
}

export function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token)
    return exp * 1000 < Date.now()
  } catch (_e) {
    return true
  }
}

export async function refreshAccessTokenIfNeeded(): Promise<string> {
  const accessToken = getAuthToken()

  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken
  }

  const csrfToken = getCsrfToken()
  if (!csrfToken) {
    clearClientAuthState()
    throw new Error('No CSRF token available for refresh')
  }

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
