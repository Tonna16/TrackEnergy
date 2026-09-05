import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  upsert: vi.fn(() => true),
  remove: vi.fn(),
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: () => ({
    appliances: [{ id: 1, name: 'Lamp', active: true, deleted: false }],
    trackedAppliances: [{ id: 1, name: 'Lamp', active: true, deleted: false }],
    historyEntries: [{ id: 'appliance:99:2024-01-01', date: '2024-01-01', scope: 'appliance', applianceId: 99, kwh: 1.25, isSample: true }],
    upsertHistoryEntry: state.upsert,
    deleteHistoryEntry: state.remove,
    historyStatus: { available: false, historyDays: 1, confidence: null, granularity: null },
  }),
}));

import UsageHistory from './UsageHistory';

describe('usage history interface', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('accepts zero, labels removed-appliance sample history, and confirms deletion', () => {
    render(<UsageHistory />);
    expect(screen.getByText('Removed appliance #99')).toBeInTheDocument();
    expect(screen.getByText('Sample')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Energy used in kWh'), { target: { value: '0' } });
    fireEvent.click(screen.getByText('Save Entry'));
    expect(state.upsert).toHaveBeenCalledWith(expect.objectContaining({ scope: 'household', kwh: 0, isSample: false }));
    fireEvent.click(screen.getByLabelText('Delete usage for 2024-01-01'));
    expect(window.confirm).toHaveBeenCalled();
    expect(state.remove).toHaveBeenCalledWith('appliance:99:2024-01-01');
  });

  it('shows validation feedback when an entry is rejected', () => {
    state.upsert.mockReturnValueOnce(false);
    render(<UsageHistory />);
    fireEvent.change(screen.getByLabelText('Energy used in kWh'), { target: { value: '1' } });
    fireEvent.click(screen.getByText('Save Entry'));
    expect(screen.getByRole('status')).toHaveTextContent('not in the future');
  });
});
