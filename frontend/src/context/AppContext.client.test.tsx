import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_STORE_KEY } from '../utils/demoStorage';

const apiGet = vi.fn();
const apiPost = vi.fn();
const refreshToken = vi.fn();

vi.mock('../utils/api', () => ({
  default: {
    get: apiGet,
    post: apiPost,
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../utils/auth', () => ({
  getAuthToken: () => null,
  refreshAccessTokenIfNeeded: refreshToken,
  logout: vi.fn(),
}));

vi.stubEnv('VITE_DEMO_MODE', 'true');
vi.stubEnv('VITE_BACKEND_ENABLED', 'false');
const { AppProvider, useAppContext } = await import('./AppContext');

function Harness() {
  const {
    appliances,
    settings,
    historyEntries,
    historyStatus,
    loadSampleHome,
    removeSampleData,
    resetDemoData,
    upsertHistoryEntry,
    deleteAppliance,
  } = useAppContext();
  return (
    <div>
      <span data-testid="count">{appliances.length}</span>
      <span data-testid="history-count">{historyEntries.length}</span>
      <span data-testid="history-confidence">{historyStatus.confidence ?? 'none'}</span>
      <span data-testid="rate">{settings.electricityRate}</span>
      {appliances.map(item => <span key={item.id}>{item.name}{item.isSample ? ' sample' : ''}</span>)}
      <button onClick={removeSampleData}>Remove samples</button>
      <button onClick={loadSampleHome}>Load samples</button>
      <button onClick={resetDemoData}>Reset all</button>
      <button onClick={() => upsertHistoryEntry({ date: '2024-01-01', scope: 'household', kwh: 0 })}>Save zero</button>
      <button onClick={() => upsertHistoryEntry({ date: '2999-01-01', scope: 'household', kwh: 1 })}>Save future</button>
      <button onClick={() => deleteAppliance(-101)}>Delete sample refrigerator</button>
    </div>
  );
}

describe('versioned client demo data', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('auto-loads deterministic samples once and makes no backend calls', async () => {
    render(<AppProvider><Harness /></AppProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('5');
    expect(screen.getByTestId('history-count')).toHaveTextContent('450');
    expect(screen.getByTestId('history-confidence')).toHaveTextContent('high');
    expect(screen.getByText('Sample Refrigerator sample')).toBeInTheDocument();
    await waitFor(() => {
      expect(localStorage.getItem(DEMO_STORE_KEY)).not.toBeNull();
      expect(apiGet).not.toHaveBeenCalled();
      expect(apiPost).not.toHaveBeenCalled();
      expect(refreshToken).not.toHaveBeenCalled();
    });
  });

  it('removes only samples and can reload them without discarding migrated user data', async () => {
    localStorage.setItem('appliances', JSON.stringify([{
      id: 42,
      name: 'My Lamp',
      type: 'other',
      location: 'Office',
      wattage: 10,
      hoursPerDay: 2,
      daysPerWeek: 7,
      isHighEfficiency: false,
      active: true,
      deleted: false,
    }]));
    localStorage.setItem('manualUsageLog', JSON.stringify([
      { date: '2024-01-01', total: 1.5 },
      { date: '2024-01-02', applianceId: 42, kwh: 0 },
    ]));
    render(<AppProvider><Harness /></AppProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('history-count')).toHaveTextContent('2');
    fireEvent.click(screen.getByText('Load samples'));
    expect(screen.getByTestId('count')).toHaveTextContent('6');
    expect(screen.getByText('My Lamp')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Remove samples'));
    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('history-count')).toHaveTextContent('2');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DEMO_STORE_KEY)!).version).toBe(2));
  });

  it('accepts zero history and persists a full reset without reseeding on refresh', async () => {
    const view = render(<AppProvider><Harness /></AppProvider>);
    fireEvent.click(screen.getByText('Save zero'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('451');
    fireEvent.click(screen.getByText('Save zero'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('451');
    fireEvent.click(screen.getByText('Save future'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('451');
    fireEvent.click(screen.getByText('Reset all'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('history-count')).toHaveTextContent('0');
    expect(screen.getByTestId('rate')).toHaveTextContent('0.17');
    await waitFor(() => expect(JSON.parse(localStorage.getItem(DEMO_STORE_KEY)!).appliances).toEqual([]));
    view.unmount();
    render(<AppProvider><Harness /></AppProvider>);
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(screen.getByTestId('history-count')).toHaveTextContent('0');
  });

  it('retains an appliance history after the appliance is deleted', async () => {
    render(<AppProvider><Harness /></AppProvider>);
    fireEvent.click(screen.getByText('Delete sample refrigerator'));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('4'));
    expect(screen.getByTestId('history-count')).toHaveTextContent('450');
  });
});
