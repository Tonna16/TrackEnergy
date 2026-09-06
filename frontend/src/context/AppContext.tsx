import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AxiosError } from 'axios';
import { applianceDatabase } from '../data/applianceDatabase';
import { createSampleHistory } from '../data/demoHistory';
import { SAMPLE_HOUSEHOLD } from '../data/demoHousehold';
import { BACKEND_ENABLED, DEMO_MODE } from '../config/runtime';
import { getAuthToken, logout, refreshAccessTokenIfNeeded } from '../utils/auth';
import {
  calculateCarbonKg,
  calculateCost,
  daysInYear,
  DEFAULT_CURRENCY,
  DEFAULT_ELECTRICITY_RATE,
  formatCurrency,
  getKwhPerDay,
  totalDailyKwh,
  type Currency,
} from '../utils/energyCalculations';
import { readStoredDemo, writeStoredDemo, type DemoStore } from '../utils/demoStorage';
import { getLocalHistoryStatus } from '../utils/historyForecast';
import { buildPrintableReportSummary, type PrintableReportSummary } from '../utils/reportSummary';
import { isVisibleAppliance, withVisibilityDefaults } from '../utils/applianceVisibility';
import { usageHistoryId, type UsageHistoryEntry } from '../types';
import api from '../utils/api';

const SAVINGS_PERCENTAGE = 0.15;
const MAX_WATTAGE = 10_000;
const MAX_KWH_PER_DAY = 30;

export type Appliance = {
  id: number;
  name: string;
  wattage: number;
  hoursPerDay: number;
  daysPerWeek: number;
  brand?: string;
  model?: string;
  type: string;
  location: string;
  isHighEfficiency: boolean;
  estimatedDailyKWh?: number | null;
  active?: boolean;
  deleted?: boolean;
  isSample?: boolean;
};

export type ApplianceInput = Omit<Appliance, 'id'>;

export type UserSettings = {
  currency: Currency;
  householdSize: number;
  darkMode: boolean;
  electricityRate: number;
};

export type UsageHistoryInput = Omit<UsageHistoryEntry, 'id' | 'isSample'> & { isSample?: boolean };
type AppMode = 'simulated' | 'live';

type AppContextType = {
  appliances: Appliance[];
  trackedAppliances: Appliance[];
  activeApplianceCount: number;
  inactiveApplianceCount: number;
  hasSampleData: boolean;
  demoMode: boolean;
  backendEnabled: boolean;
  addAppliance(input: ApplianceInput): Promise<Appliance | undefined>;
  updateAppliance(updated: Appliance): Promise<void>;
  setApplianceActive(id: number, active: boolean): Promise<void>;
  deleteAppliance(id: number): Promise<void>;
  getAppliance(id: number): Appliance | undefined;
  loadSampleHome(): void;
  removeSampleData(): void;
  resetDemoData(): void;
  clearSampleData(): void;
  resetSampleHousehold(): void;
  historyEntries: UsageHistoryEntry[];
  upsertHistoryEntry(input: UsageHistoryInput): boolean;
  deleteHistoryEntry(id: string): void;
  historyStatus: ReturnType<typeof getLocalHistoryStatus>;
  getPrintableReportSummary(periodDays: 7 | 30): PrintableReportSummary;
  totalDailyUsage: number;
  totalDailyCost: number;
  yearlyCarbonFootprint: number;
  estimatedAnnualSavings: number;
  settings: UserSettings;
  updateSettings(updates: Partial<UserSettings>): Promise<void>;
  appMode: AppMode;
  setAppMode(mode: AppMode): void;
  costFromKwh(kwh: number): number;
  formatCost(value: number): string;
  symbol: '$' | '€';
  currentRate: number;
  getApplianceTypeInfo(type: string): { averageWattage: number } | undefined;
  authReady: boolean;
  authStatus: 'checking' | 'authenticated' | 'unauthenticated';
  authError: { kind: 'transient'; message: string } | null;
  resolveAuthState(): Promise<void>;
  syncAuthModeWithToken(): Promise<void>;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const sanitizeSettings = (partial?: Partial<UserSettings>): UserSettings => ({
  currency: partial?.currency === 'EUR' ? 'EUR' : DEFAULT_CURRENCY,
  householdSize: typeof partial?.householdSize === 'number' && partial.householdSize > 0 ? partial.householdSize : 2,
  darkMode: partial?.darkMode === true,
  electricityRate:
    typeof partial?.electricityRate === 'number' && Number.isFinite(partial.electricityRate) && partial.electricityRate >= 0
      ? partial.electricityRate
      : DEFAULT_ELECTRICITY_RATE,
});

const isValidAppliance = (appliance: Appliance): boolean => {
  if (!appliance || typeof appliance !== 'object' || !appliance.name?.trim()) return false;
  if (!Number.isFinite(appliance.wattage) || appliance.wattage <= 0 || appliance.wattage > MAX_WATTAGE) return false;
  if (!Number.isFinite(appliance.hoursPerDay) || appliance.hoursPerDay < 0 || appliance.hoursPerDay > 24) return false;
  if (!Number.isInteger(appliance.daysPerWeek) || appliance.daysPerWeek < 0 || appliance.daysPerWeek > 7) return false;
  if (
    appliance.estimatedDailyKWh !== null && appliance.estimatedDailyKWh !== undefined &&
    (!Number.isFinite(appliance.estimatedDailyKWh) || appliance.estimatedDailyKWh < 0)
  ) return false;
  return getKwhPerDay(appliance) <= MAX_KWH_PER_DAY;
};

const normalizeApplianceList = (incoming: unknown): Appliance[] =>
  (Array.isArray(incoming) ? incoming : [])
    .map(appliance => withVisibilityDefaults(appliance as Appliance))
    .filter(appliance => appliance && !appliance.deleted)
    .filter(isValidAppliance);

const isIsoDate = (date: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return false;
  const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`;
  return normalized === date;
};

const normalizeHistory = (incoming: unknown): UsageHistoryEntry[] => {
  if (!Array.isArray(incoming)) return [];
  const unique = new Map<string, UsageHistoryEntry>();
  incoming.forEach(raw => {
    const entry = raw as Partial<UsageHistoryEntry>;
    if (!entry || !isIsoDate(entry.date ?? '') || !Number.isFinite(entry.kwh) || (entry.kwh ?? -1) < 0) return;
    if (entry.scope !== 'household' && entry.scope !== 'appliance') return;
    if (entry.scope === 'appliance' && !Number.isFinite(entry.applianceId)) return;
    const id = usageHistoryId(entry.date!, entry.scope, entry.applianceId);
    unique.set(id, {
      id,
      date: entry.date!,
      scope: entry.scope,
      applianceId: entry.scope === 'appliance' ? entry.applianceId : undefined,
      kwh: entry.kwh!,
      isSample: entry.isSample === true,
    });
  });
  return [...unique.values()].sort((left, right) => right.date.localeCompare(left.date));
};

const initialState = (): DemoStore => {
  if (!DEMO_MODE) return { version: 2, initialized: true, appliances: [], settings: sanitizeSettings(), history: [] };
  const stored = readStoredDemo();
  if (stored) {
    return {
      version: 2,
      initialized: stored.initialized !== false,
      appliances: normalizeApplianceList(stored.appliances),
      settings: sanitizeSettings(stored.settings),
      history: normalizeHistory(stored.history),
    };
  }
  return {
    version: 2,
    initialized: true,
    appliances: SAMPLE_HOUSEHOLD.map(appliance => ({ ...appliance })),
    settings: sanitizeSettings(),
    history: createSampleHistory(),
  };
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [initial] = useState(initialState);
  const [appliances, setAppliances] = useState<Appliance[]>(initial.appliances);
  const [settings, setSettings] = useState<UserSettings>(initial.settings);
  const [historyEntries, setHistoryEntries] = useState<UsageHistoryEntry[]>(initial.history);
  const [demoInitialized, setDemoInitialized] = useState(initial.initialized);
  const [authReady, setAuthReady] = useState(!BACKEND_ENABLED);
  const [authStatus, setAuthStatus] = useState<'checking' | 'authenticated' | 'unauthenticated'>(BACKEND_ENABLED ? 'checking' : 'unauthenticated');
  const [authError, setAuthError] = useState<{ kind: 'transient'; message: string } | null>(null);
  const [appMode, setAppModeState] = useState<AppMode>(BACKEND_ENABLED && getAuthToken() ? 'live' : 'simulated');
  const settingsRef = useRef(settings);
  const authRequestRef = useRef<{ token: string; promise: Promise<void> } | null>(null);
  const authVersionRef = useRef(0);
  const authInitializationRef = useRef<Promise<unknown> | null>(null);

  useEffect(() => { settingsRef.current = settings; }, [settings]);

  useEffect(() => {
    if (!DEMO_MODE) return;
    writeStoredDemo({ version: 2, initialized: demoInitialized, appliances, settings, history: historyEntries });
  }, [appliances, demoInitialized, historyEntries, settings]);

  useEffect(() => {
    if (!BACKEND_ENABLED) return;
    let mounted = true;
    authInitializationRef.current = refreshAccessTokenIfNeeded().catch(() => undefined).finally(() => {
      if (mounted) setAuthReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const resolveAuthState = useCallback(async () => {
    if (!BACKEND_ENABLED) {
      setAuthReady(true);
      setAuthStatus('unauthenticated');
      setAuthError(null);
      return;
    }
    const token = getAuthToken();
    if (!token) {
      authVersionRef.current += 1;
      authRequestRef.current = null;
      setAuthStatus('unauthenticated');
      setAuthError(null);
      setAppliances([]);
      setSettings(sanitizeSettings());
      return;
    }
    if (authRequestRef.current?.token === token) return authRequestRef.current.promise;
    const authVersion = ++authVersionRef.current;
    const request = (async () => {
      let profileVerified = false;
      try {
        await api.get('profile');
        profileVerified = true;
        const [applianceResponse, settingsResponse] = await Promise.all([
          api.get<Appliance[]>('appliances'), api.get('settings'),
        ]);
        if (authVersionRef.current !== authVersion || !getAuthToken()) return;
        setAppliances(normalizeApplianceList(applianceResponse.data));
        const hydratedSettings = sanitizeSettings({
          ...settingsRef.current,
          currency: settingsResponse.data?.currency,
          householdSize: settingsResponse.data?.householdSize,
          electricityRate: settingsResponse.data?.electricityRatePerKWh ?? settingsResponse.data?.electricityRate,
        });
        settingsRef.current = hydratedSettings;
        setSettings(hydratedSettings);
        setAppModeState('live');
        setAuthStatus('authenticated');
        setAuthError(null);
      } catch (error) {
        if (authVersionRef.current !== authVersion) return;
        const status = (error as AxiosError | undefined)?.response?.status;
        if (status === 401 || status === 403) {
          logout();
          setAppModeState('simulated');
          setAuthStatus('unauthenticated');
          setAuthError(null);
        } else {
          setAuthStatus('authenticated');
          setAuthError({ kind: 'transient', message: profileVerified
            ? 'Could not load your account appliances and settings. Check your connection and retry.'
            : 'Could not verify your session. Check your connection and retry.' });
        }
      }
    })();
    authRequestRef.current = { token, promise: request };
    try { await request; } finally {
      if (authRequestRef.current?.promise === request) authRequestRef.current = null;
    }
  }, []);

  const syncAuthModeWithToken = useCallback(async () => {
    await authInitializationRef.current;
    const live = BACKEND_ENABLED && Boolean(getAuthToken());
    setAppModeState(live ? 'live' : 'simulated');
    await resolveAuthState();
  }, [resolveAuthState]);

  useEffect(() => { if (authReady) void resolveAuthState(); }, [authReady, resolveAuthState]);

  const trackedAppliances = useMemo(() => appliances.filter(appliance => isVisibleAppliance(appliance, false)), [appliances]);
  const activeApplianceCount = trackedAppliances.length;
  const inactiveApplianceCount = useMemo(
    () => appliances.filter(appliance => !appliance.deleted && appliance.active === false).length,
    [appliances],
  );
  const hasSampleData = useMemo(
    () => appliances.some(appliance => appliance.isSample) || historyEntries.some(entry => entry.isSample),
    [appliances, historyEntries],
  );
  const totalDailyUsage = useMemo(() => totalDailyKwh(appliances), [appliances]);
  const currentRate = settings.electricityRate;
  const costFromKwh = useCallback((kwh: number) => calculateCost(kwh, settings.electricityRate), [settings.electricityRate]);
  const formatCost = useCallback((value: number) => formatCurrency(value, settings.currency), [settings.currency]);
  const totalDailyCost = useMemo(() => costFromKwh(totalDailyUsage), [costFromKwh, totalDailyUsage]);
  const yearlyCarbonFootprint = useMemo(
    () => calculateCarbonKg(totalDailyUsage * daysInYear(new Date().getFullYear())),
    [totalDailyUsage],
  );
  const estimatedAnnualSavings = totalDailyCost * daysInYear(new Date().getFullYear()) * SAVINGS_PERCENTAGE;
  const symbol = settings.currency === 'EUR' ? '€' : '$';
  const usesBackend = appMode === 'live' && BACKEND_ENABLED && Boolean(getAuthToken());
  const historyStatus = useMemo(() => getLocalHistoryStatus(appliances, historyEntries), [appliances, historyEntries]);
  const getPrintableReportSummary = useCallback((periodDays: 7 | 30) => buildPrintableReportSummary({
    history: historyEntries,
    totalDailyUsage,
    electricityRate: settings.electricityRate,
    periodDays,
  }), [historyEntries, settings.electricityRate, totalDailyUsage]);

  const addAppliance = async (input: ApplianceInput): Promise<Appliance | undefined> => {
    const normalized = withVisibilityDefaults({ ...input, isSample: false });
    if (!isValidAppliance({ ...normalized, id: 0 })) return undefined;
    if (usesBackend) {
      try {
        const response = await api.post<Appliance>('appliances', normalized);
        const created = withVisibilityDefaults(response.data);
        setAppliances(previous => [created, ...previous]);
        return created;
      } catch { return undefined; }
    }
    const highestId = appliances.reduce((highest, appliance) => Math.max(highest, appliance.id), 0);
    const created = { ...normalized, id: highestId + 1 };
    setAppliances(previous => [created, ...previous]);
    return created;
  };

  const updateAppliance = async (updated: Appliance) => {
    const normalized = withVisibilityDefaults(updated);
    if (!isValidAppliance(normalized)) return;
    if (usesBackend) await api.put(`appliances/${normalized.id}`, normalized);
    setAppliances(previous => previous.map(appliance => appliance.id === normalized.id ? normalized : appliance));
  };

  const setApplianceActive = async (id: number, active: boolean) => {
    if (!appliances.some(appliance => appliance.id === id)) return;
    if (usesBackend) await api.patch(`appliances/${id}/active`, { active });
    setAppliances(previous => previous.map(appliance => appliance.id === id ? { ...appliance, active } : appliance));
  };

  const deleteAppliance = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this appliance? Its history will be retained.')) return;
    if (usesBackend) await api.delete(`appliances/${id}`);
    setAppliances(previous => previous.filter(appliance => appliance.id !== id));
  };

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const merged = sanitizeSettings({ ...settingsRef.current, ...updates });
    setSettings(merged);
    if (!BACKEND_ENABLED || !getAuthToken()) return;
    try {
      const response = await api.put('settings', {
        electricityRatePerKWh: merged.electricityRate,
        householdSize: merged.householdSize,
        currency: merged.currency,
      });
      setSettings(previous => sanitizeSettings({
        ...previous,
        electricityRate: response.data?.electricityRatePerKWh ?? response.data?.electricityRate ?? merged.electricityRate,
        householdSize: response.data?.householdSize ?? merged.householdSize,
        currency: response.data?.currency ?? merged.currency,
      }));
    } catch {
      // Full-stack users keep their local UI state if the optional server is interrupted.
    }
  }, []);

  const loadSampleHome = useCallback(() => {
    setAppliances(previous => [
      ...SAMPLE_HOUSEHOLD.map(appliance => ({ ...appliance })),
      ...previous.filter(appliance => !appliance.isSample),
    ]);
    setHistoryEntries(previous => normalizeHistory([
      ...createSampleHistory(),
      ...previous.filter(entry => !entry.isSample),
    ]));
    setDemoInitialized(true);
  }, []);

  const removeSampleData = useCallback(() => {
    setAppliances(previous => previous.filter(appliance => !appliance.isSample));
    setHistoryEntries(previous => previous.filter(entry => !entry.isSample));
    setDemoInitialized(true);
  }, []);

  const resetDemoData = useCallback(() => {
    if (!DEMO_MODE || !window.confirm('Reset all local demo appliances, settings, and history? This cannot be undone.')) return;
    setAppliances([]);
    setHistoryEntries([]);
    setSettings(sanitizeSettings());
    setDemoInitialized(true);
  }, []);

  const upsertHistoryEntry = useCallback((input: UsageHistoryInput) => {
    const today = new Date();
    const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (!isIsoDate(input.date) || input.date > todayString || !Number.isFinite(input.kwh) || input.kwh < 0) return false;
    if (input.scope === 'appliance') {
      const appliance = appliances.find(candidate => candidate.id === input.applianceId);
      if (!appliance || appliance.active === false || appliance.deleted) return false;
    }
    const id = usageHistoryId(input.date, input.scope, input.applianceId);
    const entry: UsageHistoryEntry = {
      id,
      date: input.date,
      scope: input.scope,
      applianceId: input.scope === 'appliance' ? input.applianceId : undefined,
      kwh: input.kwh,
      isSample: input.isSample === true,
    };
    setHistoryEntries(previous => normalizeHistory([entry, ...previous.filter(candidate => candidate.id !== id)]));
    return true;
  }, [appliances]);

  const setAppMode = (mode: AppMode) => {
    setAppModeState(BACKEND_ENABLED && mode === 'live' && getAuthToken() ? 'live' : 'simulated');
  };

  return (
    <AppContext.Provider value={{
      appliances,
      trackedAppliances,
      activeApplianceCount,
      inactiveApplianceCount,
      hasSampleData,
      demoMode: DEMO_MODE,
      backendEnabled: BACKEND_ENABLED,
      addAppliance,
      updateAppliance,
      setApplianceActive,
      deleteAppliance,
      getAppliance: id => appliances.find(appliance => appliance.id === id),
      loadSampleHome,
      removeSampleData,
      resetDemoData,
      clearSampleData: removeSampleData,
      resetSampleHousehold: loadSampleHome,
      historyEntries,
      upsertHistoryEntry,
      deleteHistoryEntry: id => setHistoryEntries(previous => previous.filter(entry => entry.id !== id)),
      historyStatus,
      getPrintableReportSummary,
      totalDailyUsage,
      totalDailyCost,
      yearlyCarbonFootprint,
      estimatedAnnualSavings,
      settings,
      updateSettings,
      appMode,
      setAppMode,
      costFromKwh,
      formatCost,
      symbol,
      currentRate,
      getApplianceTypeInfo: type => applianceDatabase[type] ? { averageWattage: applianceDatabase[type].defaultWattage } : undefined,
      authReady,
      authStatus,
      authError,
      resolveAuthState,
      syncAuthModeWithToken,
    }}>
      {children}
    </AppContext.Provider>
  );
};

export { isVisibleAppliance } from '../utils/applianceVisibility';
export type { UsageHistoryEntry } from '../types';

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useAppContext must be used within AppProvider');
  return context;
};
