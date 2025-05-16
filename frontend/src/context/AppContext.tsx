import  { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { applianceDatabase } from '../data/applianceDatabase';

export interface Appliance {
  id: string;
  name: string;
  type: string;
  brand?: string;
  model?: string;
  wattage: number;
  hoursPerDay: number;
  daysPerWeek: number;
  isHighEfficiency: boolean;
  location: string;
}

export interface UserSettings {
  name: string;
  electricityRate: number;
  currency: string;
  householdSize: number;
  darkMode: boolean;
}

interface AppContextType {
  appliances: Appliance[];
  settings: UserSettings;
  addAppliance: (appliance: Omit<Appliance, 'id'>) => void;
  updateAppliance: (id: string, appliance: Omit<Appliance, 'id'>) => void;
  deleteAppliance: (id: string) => void;
  getAppliance: (id: string) => Appliance | undefined;
  getApplianceTypeInfo: (type: string) => { defaultWattage: number, efficiencyTips: string[] };
  updateSettings: (newSettings: Partial<UserSettings>) => void;
  totalDailyUsage: number;
  totalDailyCost: number;
  highestConsumers: Appliance[];
}

const defaultSettings: UserSettings = {
  name: 'User',
  electricityRate: 0.15, // $0.15 per kWh
  currency: 'USD',
  householdSize: 2,
  darkMode: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [appliances, setAppliances] = useState<Appliance[]>(() => {
    const saved = localStorage.getItem('appliances');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<UserSettings>(() => {
    const saved = localStorage.getItem('settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem('appliances', JSON.stringify(appliances));
  }, [appliances]);

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings));
    
    if (settings.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings]);

  const addAppliance = (appliance: Omit<Appliance, 'id'>) => {
    const newAppliance = {
      ...appliance,
      id: Date.now().toString(),
    };
    setAppliances([...appliances, newAppliance]);
  };

  const updateAppliance = (id: string, appliance: Omit<Appliance, 'id'>) => {
    setAppliances(
      appliances.map((item) => (item.id === id ? { ...appliance, id } : item))
    );
  };

  const deleteAppliance = (id: string) => {
    setAppliances(appliances.filter((item) => item.id !== id));
  };

  const getAppliance = (id: string) => {
    return appliances.find((app) => app.id === id);
  };

  const getApplianceTypeInfo = (type: string) => {
    return applianceDatabase[type] || { defaultWattage: 100, efficiencyTips: [] };
  };

  const updateSettings = (newSettings: Partial<UserSettings>) => {
    setSettings({ ...settings, ...newSettings });
  };

  // Calculate total daily usage in kWh
  const totalDailyUsage = appliances.reduce(
    (sum, appliance) => sum + (appliance.wattage * appliance.hoursPerDay * appliance.daysPerWeek / 7) / 1000,
    0
  );

  // Calculate total daily cost
  const totalDailyCost = totalDailyUsage * settings.electricityRate;

  // Get highest consuming appliances
  const highestConsumers = [...appliances]
    .sort((a, b) => 
      (b.wattage * b.hoursPerDay) - (a.wattage * a.hoursPerDay)
    )
    .slice(0, 3);

  return (
    <AppContext.Provider
      value={{
        appliances,
        settings,
        addAppliance,
        updateAppliance,
        deleteAppliance,
        getAppliance,
        getApplianceTypeInfo,
        updateSettings,
        totalDailyUsage,
        totalDailyCost,
        highestConsumers,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}
 