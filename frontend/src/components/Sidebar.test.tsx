import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UsageHistoryEntry } from '../types';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  backendEnabled: false,
  demoMode: true,
  historyEntries: [] as UsageHistoryEntry[],
}));

vi.mock('../utils/api', () => ({ default: { get: mocks.apiGet } }));
vi.mock('../utils/auth', () => ({ getAuthToken: () => mocks.backendEnabled ? 'token' : null }));
vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    totalDailyUsage: 4.25,
    backendEnabled: mocks.backendEnabled,
    demoMode: mocks.demoMode,
    historyEntries: mocks.historyEntries,
  }),
}));

import Sidebar from './Sidebar';

const todayIso = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const renderSidebar = () => render(
  <MemoryRouter>
    <Sidebar open setOpen={vi.fn()} />
  </MemoryRouter>,
);

describe('Sidebar daily usage provenance', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.backendEnabled = false;
    mocks.demoMode = true;
    mocks.historyEntries = [];
  });

  it('shows Estimated Daily Usage when no reading exists', () => {
    renderSidebar();
    expect(screen.getByText('Estimated Daily Usage')).toBeInTheDocument();
    expect(screen.getByText('4.25 kWh')).toBeInTheDocument();
    expect(screen.getByText('Formula estimate from included appliances')).toBeInTheDocument();
  });

  it('treats an explicit local zero today as Recorded Daily Usage', () => {
    mocks.historyEntries = [{
      id: `household:${todayIso()}`,
      date: todayIso(),
      scope: 'household',
      kwh: 0,
      isSample: false,
    }];
    renderSidebar();
    expect(screen.getByText('Recorded Daily Usage')).toBeInTheDocument();
    expect(screen.getByText('0.00 kWh')).toBeInTheDocument();
    expect(screen.getByText(/may be incomplete/)).toBeInTheDocument();
  });

  it('falls back to Estimated Daily Usage when the full-stack reading request fails', async () => {
    mocks.backendEnabled = true;
    mocks.demoMode = false;
    mocks.apiGet.mockRejectedValue(new Error('offline'));
    renderSidebar();
    await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Formula estimate from included appliances')).toBeInTheDocument();
    expect(screen.getByText('Estimated Daily Usage')).toBeInTheDocument();
  });

  it('preserves a recorded zero returned by the backend', async () => {
    mocks.backendEnabled = true;
    mocks.demoMode = false;
    mocks.apiGet.mockImplementation((_url: string, options: { params: { day: string } }) => Promise.resolve({
      data: {
        date: todayIso(),
        totalKwh: 0,
        hasRecordedUsage: options.params.day === 'today',
      },
    }));
    renderSidebar();
    expect(await screen.findByText('Recorded Daily Usage')).toBeInTheDocument();
    expect(screen.getByText('0.00 kWh')).toBeInTheDocument();
  });
});
