import type { Appliance, UserSettings } from '../context/AppContext';
import type { UsageHistoryEntry } from '../types';
import { usageHistoryId } from '../types';

export const DEMO_STORE_KEY = 'energyiq.demo.v2';

export type DemoStore = {
  version: 2;
  initialized: boolean;
  appliances: Appliance[];
  settings: UserSettings;
  history: UsageHistoryEntry[];
};

type LegacyUsageLog = {
  date?: string;
  total?: number;
  totalKwh?: number;
  kwh?: number;
  scope?: 'household' | 'appliance';
  applianceId?: number;
  byAppliance?: Record<string, number>;
};

const readJson = (key: string): unknown => {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};

export function readStoredDemo(): Partial<DemoStore> | null {
  const current = readJson(DEMO_STORE_KEY);
  if (current && typeof current === 'object' && (current as { version?: number }).version === 2) {
    return current as DemoStore;
  }

  const appliances = readJson('appliances');
  const settings = readJson('settings');
  const legacyLogs = readJson('manualUsageLog');
  const initialized = Boolean(localStorage.getItem('energyiqDemoInitialized'));
  if (!appliances && !settings && !legacyLogs && !initialized) return null;

  const applianceList = Array.isArray(appliances) ? appliances as Appliance[] : [];
  const history: UsageHistoryEntry[] = [];
  if (Array.isArray(legacyLogs)) {
    for (const raw of legacyLogs as LegacyUsageLog[]) {
      if (typeof raw.date !== 'string') continue;
      const directApplianceKwh = typeof raw.kwh === 'number' && Number.isFinite(raw.kwh) && raw.kwh >= 0
        && (raw.scope === 'appliance' || Number.isFinite(raw.applianceId))
        ? raw.kwh : undefined;
      if (directApplianceKwh !== undefined && Number.isFinite(raw.applianceId)) {
        history.push({
          id: usageHistoryId(raw.date, 'appliance', raw.applianceId),
          date: raw.date,
          scope: 'appliance',
          applianceId: raw.applianceId,
          kwh: directApplianceKwh,
          isSample: false,
        });
      }
      const total = raw.total ?? raw.totalKwh ?? (
        raw.scope !== 'appliance' && !Number.isFinite(raw.applianceId) ? raw.kwh : undefined
      );
      if (typeof total === 'number' && Number.isFinite(total) && total >= 0) {
        history.push({
          id: usageHistoryId(raw.date, 'household'),
          date: raw.date,
          scope: 'household',
          kwh: total,
          isSample: false,
        });
      }
      for (const [name, kwh] of Object.entries(raw.byAppliance ?? {})) {
        const appliance = applianceList.find(candidate => candidate.name === name);
        if (!appliance || !Number.isFinite(kwh) || kwh < 0) continue;
        history.push({
          id: usageHistoryId(raw.date, 'appliance', appliance.id),
          date: raw.date,
          scope: 'appliance',
          applianceId: appliance.id,
          kwh,
          isSample: false,
        });
      }
    }
  }

  return {
    version: 2,
    initialized,
    appliances: applianceList,
    settings: settings && typeof settings === 'object' ? settings as UserSettings : undefined,
    history,
  };
}

export function writeStoredDemo(store: DemoStore) {
  localStorage.setItem(DEMO_STORE_KEY, JSON.stringify(store));
}
