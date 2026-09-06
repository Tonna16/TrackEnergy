import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../config/runtime', () => ({ BACKEND_ENABLED: true, DEMO_MODE: false }));
vi.mock('../utils/api', () => ({ default: mocks }));
vi.mock('../utils/auth', () => ({
  getAuthToken: () => localStorage.getItem('accessToken'),
  saveAuthToken: (token: string) => localStorage.setItem('accessToken', token),
  saveUser: vi.fn(),
  refreshAccessTokenIfNeeded: () => Promise.resolve(localStorage.getItem('accessToken')),
  logout: vi.fn(),
}));

import { AppProvider, useAppContext } from './AppContext';
import LoginPage from '../pages/LoginPage';

const appliance = {
  id: 42, name: 'Existing Lamp', wattage: 20, hoursPerDay: 3, daysPerWeek: 7,
  type: 'other', location: 'Office', isHighEfficiency: false, active: true, deleted: false,
};

function Account() {
  const { appliances, settings, authStatus, authReady, authError, resolveAuthState } = useAppContext();
  return <>
    <span>{authReady ? 'Session ready' : 'Checking session'}</span>
    <span>{authStatus}</span>
    <span>{appliances.map(item => item.name).join(', ')}</span>
    <span>{settings.currency} {settings.electricityRate} / {settings.householdSize} people</span>
    {authError && <button onClick={() => void resolveAuthState()}>{authError.message} Retry</button>}
  </>;
}

describe('full-stack account hydration', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.get.mockImplementation((url: string) => Promise.resolve({ data: url === 'appliances'
      ? [appliance] : url === 'settings' ? { currency: 'EUR', electricityRatePerKWh: 0.31, householdSize: 4 } : {} }));
    mocks.post.mockResolvedValue({ data: { accessToken: 'existing-user-token', user: {} } });
  });

  it('loads existing appliances and settings before login navigation without remounting the provider', async () => {
    render(<MemoryRouter initialEntries={['/login']}><AppProvider>
      <Account />
      <Routes><Route path="/login" element={<LoginPage />} /><Route path="/" element={<span>Dashboard</span>} /></Routes>
    </AppProvider></MemoryRouter>);
    await screen.findByText('Session ready');
    expect(mocks.get).not.toHaveBeenCalled();
    fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'existing@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'test-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Login' }));
    await screen.findByText('Dashboard');
    expect(screen.getByText('Existing Lamp')).toBeInTheDocument();
    expect(screen.getByText('EUR 0.31 / 4 people')).toBeInTheDocument();
    expect(mocks.get.mock.calls.map(([url]) => url)).toEqual(['profile', 'appliances', 'settings']);
  });

  it('hydrates a restored session on startup', async () => {
    localStorage.setItem('accessToken', 'restored-token');
    render(<AppProvider><Account /></AppProvider>);
    await screen.findByText('Existing Lamp');
    expect(screen.getByText('EUR 0.31 / 4 people')).toBeInTheDocument();
    expect(screen.getByText('authenticated')).toBeInTheDocument();
  });

  it('reports a hydration failure and reloads account data on retry', async () => {
    localStorage.setItem('accessToken', 'restored-token');
    mocks.get.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce(new Error('Connection interrupted'));
    render(<AppProvider><Account /></AppProvider>);
    fireEvent.click(await screen.findByRole('button', { name: /Could not load your account/ }));
    await screen.findByText('Existing Lamp');
    await waitFor(() => expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument());
  });
});
