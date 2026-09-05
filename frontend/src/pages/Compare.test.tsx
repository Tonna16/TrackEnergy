import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  backendEnabled: false,
  token: null as string | null,
}));

vi.mock('../components/EnergyUsageChart', () => ({ default: () => <div>Formula Projection Chart</div> }));
vi.mock('../utils/api', () => ({ default: { get: mocks.apiGet } }));
vi.mock('../utils/auth', () => ({ getAuthToken: () => mocks.token }));
vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    totalDailyUsage: 4,
    trackedAppliances: [{
      id: 1,
      name: 'Kitchen Refrigerator',
      type: 'refrigerator',
      location: 'Kitchen',
      wattage: 150,
      hoursPerDay: 8,
      daysPerWeek: 7,
      isHighEfficiency: false,
      active: true,
    }],
    settings: { householdSize: 2 },
    getApplianceTypeInfo: () => ({ averageWattage: 150 }),
    backendEnabled: mocks.backendEnabled,
  }),
}));

import Compare from './Compare';

describe('honest illustrative reference language', () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.backendEnabled = false;
    mocks.token = null;
  });

  it('always displays source provenance and the whole-home coverage warning', () => {
    render(<Compare />);
    expect(screen.getByText(/Whole-home comparison warning:/)).toBeInTheDocument();
    expect(screen.getByText(/HVAC, water heating, refrigeration, cooking, lighting, laundry, EV charging, and pool equipment/)).toBeInTheDocument();
    expect(screen.getByText(/EnergyIQ bundled illustrative planning assumptions—not measured local, national, or community data/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Static General Reference' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Static Household Reference' })).toBeInTheDocument();
  });

  it('uses neutral reference differences and never presents generated scenarios as users', () => {
    render(<Compare />);
    expect(screen.getByText('Estimated Difference from Reference')).toBeInTheDocument();
    expect(screen.getByText(/not an efficiency rating, audit, ranking, or measured result/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Illustrative Scenarios' }));
    expect(screen.getByText('Illustrative Scenario References')).toBeInTheDocument();
    expect(screen.getByText('Illustrative Typical Scenario')).toBeInTheDocument();
    expect(screen.queryByText(/Top 40%/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/your area/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/community users|real users/i)).not.toBeInTheDocument();
  });

  it('describes H2-derived values as local-installation records, not representative statistics', async () => {
    mocks.backendEnabled = true;
    mocks.token = 'token';
    mocks.apiGet.mockResolvedValue({
      data: { householdAvg: 7.5, source: 'local-database', isSample: false },
    });
    render(<Compare />);
    fireEvent.click(screen.getByRole('button', { name: 'Illustrative Scenarios' }));

    expect(await screen.findByText('Local H2 Stored-Record Average')).toBeInTheDocument();
    expect(screen.getByText(/average of recorded entries stored in this installation/)).toBeInTheDocument();
    expect(screen.getByText(/not a representative community or user statistic/)).toBeInTheDocument();
  });
});
