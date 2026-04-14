import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ProtectedRoute from './ProtectedRoute'
import { AppProvider } from '../context/AppContext'

const mockGetAuthToken = vi.fn<() => string | null>()
const mockRefreshAccessTokenIfNeeded = vi.fn<() => Promise<string>>()
const mockLogout = vi.fn()

vi.mock('../utils/auth', () => ({
  getAuthToken: () => mockGetAuthToken(),
  refreshAccessTokenIfNeeded: () => mockRefreshAccessTokenIfNeeded(),
  logout: () => mockLogout(),
  saveAuthToken: vi.fn(),
  isTokenExpired: vi.fn(() => false),
  getCsrfToken: vi.fn(() => null),
}))

const mockApiGet = vi.fn<(url: string) => Promise<{ data: unknown }>>()
const mockApiPost = vi.fn<() => Promise<{ data: unknown }>>()
const mockApiPut = vi.fn<() => Promise<{ data: unknown }>>()
const mockApiDelete = vi.fn<() => Promise<{ data: unknown }>>()

vi.mock('../utils/api', () => ({
  default: {
    get: (url: string) => mockApiGet(url),
    post: () => mockApiPost(),
    put: () => mockApiPut(),
    delete: () => mockApiDelete(),
  },
}))

function renderProtectedRoute(initialPath = '/profile') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppProvider>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<div>Private Profile</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </AppProvider>
    </MemoryRouter>
  )
}

describe('ProtectedRoute auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()

    mockRefreshAccessTokenIfNeeded.mockResolvedValue('fresh-token')
    mockApiPost.mockResolvedValue({ data: {} })
    mockApiPut.mockResolvedValue({ data: {} })
    mockApiDelete.mockResolvedValue({ data: {} })
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === 'profile') return { data: { id: 1 } }
      if (url === 'settings') return { data: {} }
      if (url === 'appliances') return { data: [] }
      if (url === 'energy-usage/forecasted-daily-cost') return { data: null }
      return { data: {} }
    })
  })

  it('no token -> redirects to login for private route', async () => {
    mockGetAuthToken.mockReturnValue(null)

    renderProtectedRoute('/profile')

    expect(await screen.findByText('Login Page')).toBeInTheDocument()
    expect(mockApiGet).not.toHaveBeenCalledWith('profile')
    expect(mockLogout).not.toHaveBeenCalled()
  })

  it('401 profile check -> logout + redirect', async () => {
    mockGetAuthToken.mockReturnValue('expired-or-invalid-token')
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === 'profile') {
        const err = new Error('Unauthorized') as Error & { response?: { status: number } }
        err.response = { status: 401 }
        throw err
      }
      if (url === 'settings') return { data: {} }
      if (url === 'appliances') return { data: [] }
      if (url === 'energy-usage/forecasted-daily-cost') return { data: null }
      return { data: {} }
    })

    renderProtectedRoute('/profile')

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1)
    })
    expect(await screen.findByText('Login Page')).toBeInTheDocument()
  })

  it('network profile check error -> no forced logout (stale session allowed)', async () => {
    mockGetAuthToken.mockReturnValue('token-that-might-still-be-valid')
    mockApiGet.mockImplementation(async (url: string) => {
      if (url === 'profile') throw new Error('Network timeout')
      if (url === 'settings') return { data: {} }
      if (url === 'appliances') return { data: [] }
      if (url === 'energy-usage/forecasted-daily-cost') return { data: null }
      return { data: {} }
    })

    renderProtectedRoute('/profile')

    expect(await screen.findByText('Private Profile')).toBeInTheDocument()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify your session')
    expect(mockLogout).not.toHaveBeenCalled()
  })
})
