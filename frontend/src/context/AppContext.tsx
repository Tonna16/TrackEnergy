import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useMemo,
  ReactNode,
} from 'react';
import { applianceDatabase } from '../data/applianceDatabase';

export type Appliance = {
  id: string;
  name: string;
  wattage: number;
  hoursPerDay: number;
  daysPerWeek: number;
  brand?: string;
  model?: string;
  type: string;
  location: string;
  isHighEfficiency: boolean;
  estimatedDailyKWh?: number;
};

export type ApplianceInput = Omit<Appliance, 'id'>;

export type DailyUsagePoint = {
  date: string;
  total: number;
  byAppliance: Record<string, number>;
};

export type UserSettings = {
  currency: 'USD' | 'EUR';
  householdSize: number;
  darkMode: boolean;
  electricityRate: number;
  name: string;
};

type UsageLog = {
  date: string;
  total: number;
  byAppliance: Record<string, number>;
};

type AppMode = 'simulated' | 'live';

type AppContextType = {
  appliances: Appliance[];
  addAppliance: (input: ApplianceInput) => void;
  updateAppliance: (updated: Appliance) => void;
  deleteAppliance: (id: string) => void;
  getAppliance: (id: string) => Appliance | undefined;
  totalDailyUsage: number;
  totalDailyCost: number;
  yearlyCarbonFootprint: number;
  estimatedAnnualSavings: number;
  highestConsumers: Appliance[];
  topConsumers: { appliance: Appliance; usage: number }[];
  dailyUsageSeries: DailyUsagePoint[];
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  appMode: AppMode;
  setAppMode: (mode: AppMode) => void;
  getApplianceTypeInfo: (type: string) => { averageWattage: number } | undefined;
  logManualUsage: (log: UsageLog) => void;
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const EMISSION_FACTOR_KG_PER_KWH = 0.417;
const SAVINGS_PERCENTAGE = 0.15;

const defaultSettings: UserSettings = {
  currency: 'USD',
  householdSize: 2,
  darkMode: false,
  electricityRate: 0.15,
  name: 'User',
};

// ✅ Generate ID safely across all browsers
const generateId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 10);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [appliances, setAppliances] = useState<Appliance[]>(() => {
    const saved = localStorage.getItem('appliances');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  const [appMode, setAppMode] = useState<AppMode>(() => {
    const saved = localStorage.getItem('appMode');
    return saved === 'live' ? 'live' : 'simulated';
  });

  const [manualUsageLog, setManualUsageLog] = useState<UsageLog[]>(() => {
    const saved = localStorage.getItem('manualUsageLog');
    return saved ? JSON.parse(saved) : [];
  });

  const [fxRate, setFxRate] = useState<number>(1);

  useEffect(() => {
    localStorage.setItem('appliances', JSON.stringify(appliances));
  }, [appliances]);

  useEffect(() => {
    localStorage.setItem('appMode', appMode);
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('manualUsageLog', JSON.stringify(manualUsageLog));
  }, [manualUsageLog]);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
    document.documentElement.classList.toggle('dark', settings.darkMode);
  }, [settings]);

  useEffect(() => {
    if (settings.currency === 'USD') {
      setFxRate(1);
      return;
    }
    fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR')
      .then(res => res.json())
      .then(json => {
        if (json.rates && json.rates.EUR) {
          setFxRate(json.rates.EUR);
        }
      })
      .catch(() => {
        console.warn('Failed to fetch FX rate, defaulting to 1.');
        setFxRate(1);
      });
  }, [settings.currency]);

  const updateSettings = (updates: Partial<UserSettings>) => {
    setSettings(prev => {
      if (updates.currency && updates.currency !== prev.currency) {
        const newRate =
          updates.currency === 'EUR'
            ? prev.electricityRate * fxRate
            : prev.electricityRate / fxRate;
        return { ...prev, ...updates, electricityRate: newRate };
      }
      return { ...prev, ...updates };
    });
  };

  const addAppliance = (input: ApplianceInput) => {
    const nameKey = input.name.trim().toLowerCase();
    if (appliances.some(a => a.name.trim().toLowerCase() === nameKey)) {
      throw new Error('You already have an appliance by that name.');
    }
    if (!applianceDatabase[input.type]) {
      throw new Error(`Unknown appliance type: "${input.type}".`);
    }
    if (input.wattage <= 0 || input.hoursPerDay < 0 || input.daysPerWeek < 0) {
      throw new Error('Invalid appliance data.');
    }
    setAppliances(prev => [...prev, { ...input, id: generateId() }]);
  };

  const updateAppliance = (updated: Appliance) =>
    setAppliances(prev => prev.map(a => (a.id === updated.id ? updated : a)));

  const deleteAppliance = (id: string) =>
    setAppliances(prev => prev.filter(a => a.id !== id));

  const getAppliance = (id: string) => appliances.find(a => a.id === id);

  const logManualUsage = (log: UsageLog) =>
    setManualUsageLog(prev => {
      const withoutDate = prev.filter(e => e.date !== log.date);
      return [...withoutDate, log].sort((a, b) => a.date.localeCompare(b.date));
    });

  const totalDailyUsage = useMemo(
    () =>
      appliances.reduce(
        (sum, a) =>
          sum + (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000,
        0
      ),
    [appliances]
  );

  const totalDailyCost = useMemo(
    () => totalDailyUsage * settings.electricityRate,
    [totalDailyUsage, settings.electricityRate]
  );

  const yearlyCarbonFootprint = useMemo(
    () => totalDailyUsage * 365 * EMISSION_FACTOR_KG_PER_KWH,
    [totalDailyUsage]
  );

  const estimatedAnnualSavings = useMemo(
    () => totalDailyCost * 365 * SAVINGS_PERCENTAGE,
    [totalDailyCost]
  );

  const highestConsumers = useMemo(
    () =>
      [...appliances]
        .sort((a, b) => {
          const ua =
            (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000;
          const ub =
            (b.wattage * b.hoursPerDay * (b.daysPerWeek / 7)) / 1000;
          return ub - ua;
        })
        .slice(0, 3),
    [appliances]
  );

  const topConsumers = useMemo(
    () =>
      [...appliances]
        .map(a => ({
          appliance: a,
          usage:
            (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000,
        }))
        .sort((x, y) => y.usage - x.usage)
        .slice(0, 5),
    [appliances]
  );

  const dailyUsageSeries = useMemo<DailyUsagePoint[]>(() => {
    const days = 30;
    const today = new Date().toISOString().split('T')[0];
    const filtered = manualUsageLog.filter(l => l.date >= today);
    const series: DailyUsagePoint[] = [];

    for (let i = 1; i <= days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      if (appMode === 'live') {
        const log = filtered.find(l => l.date === key);
        if (log) {
          series.push({
            date: log.date,
            total: log.total,
            byAppliance: log.byAppliance,
          });
          continue;
        }
      }
      let total = 0;
      const byAppliance: Record<string, number> = {};
      appliances.forEach(app => {
        const base = (app.wattage * app.hoursPerDay) / 1000;
        const variation = 1 + (Math.random() * 0.3 - 0.15);
        const usage = base * variation;
        byAppliance[app.name] = usage;
        total += usage;
      });
      series.push({ date: key, total, byAppliance });
    }
    return series;
  }, [appliances, appMode, manualUsageLog]);

  const getApplianceTypeInfo = (type: string) => {
    const entry = applianceDatabase[type];
    return entry ? { averageWattage: entry.defaultWattage } : undefined;
  };

  return (
    <AppContext.Provider
      value={{
        appliances,
        addAppliance,
        updateAppliance,
        deleteAppliance,
        getAppliance,
        totalDailyUsage,
        totalDailyCost,
        yearlyCarbonFootprint,
        estimatedAnnualSavings,
        highestConsumers,
        topConsumers,
        dailyUsageSeries,
        settings,
        updateSettings,
        logManualUsage,
        appMode,
        setAppMode,
        getApplianceTypeInfo,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextType => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
};
