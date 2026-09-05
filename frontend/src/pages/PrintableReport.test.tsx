import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  history: [] as Array<{
    id: string;
    date: string;
    scope: 'household' | 'appliance';
    applianceId?: number;
    kwh: number;
    isSample: boolean;
  }>,
}));

const yesterday = () => {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    trackedAppliances: [{
      id: 1, name: 'Desk Lamp', type: 'other', location: 'Office', wattage: 10,
      hoursPerDay: 2, daysPerWeek: 7, isHighEfficiency: false, active: true, deleted: false,
    }],
    historyEntries: state.history,
    totalDailyUsage: 2,
    settings: { electricityRate: 0.2, currency: 'USD' },
    formatCost: (value: number) => `$${value.toFixed(2)}`,
    getPrintableReportSummary: (periodDays: 7 | 30) => {
      const usesHistory = state.history.length > 0;
      const kwh = usesHistory ? 3 : periodDays * 2;
      return {
        startDate: '2026-01-01', endDate: '2026-01-07', periodDays,
        observedDays: usesHistory ? 1 : 0, usesHistory,
        includesSample: usesHistory, kwh, cost: kwh * 0.2, carbonKg: kwh * 0.394,
      };
    },
  }),
}));

import PrintableReport from './PrintableReport';

const renderReport = () => render(<MemoryRouter><PrintableReport /></MemoryRouter>);

describe('printable local reports', () => {
  beforeEach(() => {
    state.history = [{ id: 'sample', date: yesterday(), scope: 'household', kwh: 3, isSample: true }];
  });

  it('reports observed-day coverage without silently filling missing days and prints locally', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    renderReport();
    expect(screen.getByText('Source: Recorded Usage History')).toBeInTheDocument();
    expect(screen.getByText(/1 of 7 days have user-entered or persisted observations/)).toBeInTheDocument();
    expect(screen.getByText(/Sample-data warning/)).toBeInTheDocument();
    expect(screen.getByText('3.00 kWh')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Monthly'));
    expect(screen.getByText(/1 of 30 days have user-entered or persisted observations/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Print / Save as PDF'));
    expect(print).toHaveBeenCalledOnce();
  });

  it('falls back prominently to the Formula Estimate when the window has no history', () => {
    state.history = [];
    renderReport();
    expect(screen.getByText('Source: Formula Estimate')).toBeInTheDocument();
    expect(screen.getByText(/No observations exist/)).toBeInTheDocument();
    expect(screen.getByText('14.00 kWh')).toBeInTheDocument();
  });
});
