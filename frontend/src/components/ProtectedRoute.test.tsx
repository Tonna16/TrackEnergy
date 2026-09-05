import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetAuthToken = vi.fn<() => string | null>();
const mockRefreshAccessTokenIfNeeded = vi.fn<() => Promise<string>>();
const mockLogout = vi.fn();
const mockApiGet = vi.fn<(url: string) => Promise<{ data: unknown }>>();

vi.mock('../utils/auth', () => ({
  getAuthToken: () => mockGetAuthToken(),
  refreshAccessTokenIfNeeded: () => mockRefreshAccessTokenIfNeeded(),
  logout: () => mockLogout(),
}));

vi.mock('../utils/api', () => ({
  default: {
    get: (url: string) => mockApiGet(url),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.stubEnv('VITE_BACKEND_ENABLED', 'true');
const [{ default: ProtectedRoute }, { AppProvider }] = await Promise.all([
  import('./ProtectedRoute'),
  import('../context/AppContext'),
]);

function renderProtectedRoute() {
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/profile']}>
        <AppProvider>
          <Routes>
            <Route element={<ProtectedRoute />}>
              <Route path="/profile" element={<div>Private Profile</div>} />
            </Route>
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </AppProvider>
      </MemoryRouter>
    </StrictMode>,
  );
}

describe('ProtectedRoute auth guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockRefreshAccessTokenIfNeeded.mockResolvedValue('fresh-token');
    mockApiGet.mockImplementation(async url => {
      if (url === 'profile') return { data: { id: 1 } };
      if (url === 'settings') return { data: {} };
      if (url === 'appliances') return { data: [] };
      return { data: {} };
    });
  });

  it('redirects a user with no token', async () => {
    mockGetAuthToken.mockReturnValue(null);
    renderProtectedRoute();
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
    expect(mockApiGet).not.toHaveBeenCalledWith('profile');
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it('logs out exactly once after a 401, including in StrictMode', async () => {
    let token: string | null = 'invalid-token';
    mockGetAuthToken.mockImplementation(() => token);
    mockLogout.mockImplementation(() => { token = null; });
    mockApiGet.mockImplementation(async url => {
      if (url === 'profile') {
        const error = new Error('Unauthorized') as Error & { response?: { status: number } };
        error.response = { status: 401 };
        throw error;
      }
      return { data: url === 'appliances' ? [] : {} };
    });

    renderProtectedRoute();
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Login Page')).toBeInTheDocument();
  });

  it('keeps a stale session on a transient profile failure', async () => {
    mockGetAuthToken.mockReturnValue('possibly-valid-token');
    mockApiGet.mockImplementation(async url => {
      if (url === 'profile') throw new Error('Network timeout');
      return { data: url === 'appliances' ? [] : {} };
    });
    renderProtectedRoute();
    expect(await screen.findByText('Private Profile')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not verify your session');
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
