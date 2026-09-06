import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  backendEnabled: false,
  demoMode: true,
}));

const appliance = {
  id: 1,
  name: 'Test Computer',
  type: 'computer',
  location: 'Office',
  wattage: 200,
  hoursPerDay: 6,
  daysPerWeek: 5,
  isHighEfficiency: false,
  active: true,
  deleted: false,
};
const applianceList = [appliance];

vi.mock('../utils/api', () => ({ default: { get: mocks.apiGet } }));
vi.mock('../utils/auth', () => ({
  getAuthToken: () => mocks.backendEnabled ? 'test-token' : null,
}));
vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    appliances: applianceList,
    trackedAppliances: applianceList,
    symbol: '$',
    settings: { currency: 'USD', electricityRate: 0.2 },
    costFromKwh: (kwh: number) => kwh * 0.2,
    backendEnabled: mocks.backendEnabled,
    demoMode: mocks.demoMode,
    historyEntries: [],
  }),
}));
vi.mock('recharts', () => {
  const Container = ({ children }: { children?: ReactNode }) => <div>{children}</div>;
  const Empty = () => null;
  return {
    LineChart: Container,
    Line: Empty,
    XAxis: Empty,
    YAxis: Empty,
    Tooltip: Empty,
    ReferenceLine: Empty,
    ResponsiveContainer: Container,
  };
});

const renderChart = () => render(
  <MemoryRouter>
    <EnergyUsageChart useEstimate />
  </MemoryRouter>,
);

import EnergyUsageChart from './EnergyUsageChart';

describe('EnergyUsageChart source behavior', () => {
  beforeEach(() => {
    mocks.backendEnabled = false;
    mocks.demoMode = true;
    mocks.apiGet.mockReset();
  });

  it('offers local forecast sources without making an API request in demo mode', async () => {
    renderChart();
    expect(screen.getByText(/Formula Projection\. Future values are projections/)).toBeInTheDocument();
    const selector = screen.getByLabelText('Projection or forecast source');
    expect(selector).toHaveValue('formula');
    expect(screen.getByRole('option', { name: 'Formula Projection' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /History-Based Forecast \(0\/60 days\)/ })).toBeDisabled();
    await waitFor(() => expect(mocks.apiGet).not.toHaveBeenCalled());
  });

  it('falls back visibly without mixing data when history is insufficient', async () => {
    mocks.backendEnabled = true;
    mocks.demoMode = false;
    mocks.apiGet.mockImplementation((url: string) => {
      if (url.includes('history-forecast')) {
        return Promise.resolve({
          data: {
            status: 'insufficient_history',
            source: 'history-based',
            dataCoverage: '12/90 completed days recorded; 12/60 in the latest training window',
            historyDays: 12,
            requiredHistoryDays: 60,
            explanation: 'History-Based Forecast needs 60 valid days for every active appliance.',
            projections: [{ date: '2099-01-01', totalCost: 9999, byAppCost: {} }],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    renderChart();
    const selector = await screen.findByLabelText('Projection or forecast source');
    fireEvent.change(selector, { target: { value: 'history' } });

    expect(await screen.findByRole('status')).toHaveTextContent('needs 60 valid days');
    await waitFor(() => expect(selector).toHaveValue('formula'));
    expect(screen.queryByText('9999')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Formula Projection/).length).toBeGreaterThan(0);
  });

  it('uses forecast language only for available history-driven output', async () => {
    mocks.backendEnabled = true;
    mocks.demoMode = false;
    mocks.apiGet.mockImplementation((url: string) => Promise.resolve(url.includes('history-forecast')
      ? {
          data: {
            status: 'available',
            source: 'history-based',
            dataCoverage: '90/90 completed days recorded; 60/60 in the latest training window',
            historyDays: 90,
            requiredHistoryDays: 60,
            projections: [{ date: '2099-01-01', totalKwh: 2, totalCost: 0.4, byAppCost: {} }],
          },
        }
      : { data: [] }));

    renderChart();
    const selector = await screen.findByLabelText('Projection or forecast source');
    fireEvent.change(selector, { target: { value: 'history' } });

    expect(await screen.findByText(/History-Based Forecast · 90\/90 completed days recorded/)).toBeInTheDocument();
    expect(screen.getByText(/Server history forecast \(API-only\)/)).toBeInTheDocument();
    expect(screen.getByText(/deterministic forecast uses recorded history only/)).toBeInTheDocument();
  });
});
