import { jwtDecode } from 'jwt-decode'
import axios from 'axios'

export const getAuthToken = () => localStorage.getItem('accessToken')
export const getRefreshToken = () => localStorage.getItem('refreshToken')

export const saveAuthToken = (token: string) => {
  localStorage.setItem('accessToken', token)
}

export const saveRefreshToken = (token: string) => {
  localStorage.setItem('refreshToken', token)
}

export const saveUser = (user: any) => {
  localStorage.setItem('user', JSON.stringify(user))
}

export const getUser = (): any | null => {
  const raw = localStorage.getItem('user')
  return raw ? JSON.parse(raw) : null
}

export const logout = () => {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
  localStorage.removeItem('user')
  sessionStorage.clear()
  window.location.href = '/'
}

export function isTokenExpired(token: string): boolean {
  try {
    const { exp } = jwtDecode<{ exp: number }>(token)
    return exp * 1000 < Date.now()
  } catch (e) {
    return true
  }
}

export async function refreshAccessTokenIfNeeded(): Promise<string> {
  const accessToken = getAuthToken()
  const refreshToken = getRefreshToken()

  if (!refreshToken) {
    throw new Error('No refresh token available')
  }

  if (accessToken && !isTokenExpired(accessToken)) {
    return accessToken
  }

  const response = await axios.post('/api/auth/refresh', { refreshToken })
  const newAccessToken = response.data.accessToken
  const newRefreshToken = response.data.refreshToken

  saveAuthToken(newAccessToken)
  saveRefreshToken(newRefreshToken)

  return newAccessToken
}
