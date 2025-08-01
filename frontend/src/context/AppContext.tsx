// src/context/AppContext.tsx
import React, {
  useEffect,
  createContext,
  useContext,
  useState,
  useMemo,
  useCallback,
  ReactNode,
} from 'react'
import { applianceDatabase } from '../data/applianceDatabase'
import { getAuthToken } from '../utils/auth'
import { generateEstimate } from '../utils/energyEstimator'

const API_URL = '/api/appliances'
const EMISSION_FACTOR_KG_PER_KWH = 0.417
const SAVINGS_PERCENTAGE = 0.15
const DEFAULT_USD_TO_EUR = 0.86

export type Appliance = {
  id: string
  name: string
  wattage: number
  hoursPerDay: number
  daysPerWeek: number
  brand?: string
  model?: string
  type: string
  location: string
  isHighEfficiency: boolean
  estimatedDailyKWh?: number
}

type ApplianceInput = Omit<Appliance, 'id'>

type UserSettings = {
  currency: 'USD' | 'EUR'
  householdSize: number
  darkMode: boolean
  electricityRate: number
  exchangeRate: number
}

type UsageLog = {
  date: string
  total: number
  byAppliance: Record<string, number>
}

type AppMode = 'simulated' | 'live'

type AppContextType = {
  appliances: Appliance[]
  addAppliance(input: ApplianceInput): Promise<void>
  updateAppliance(updated: Appliance): Promise<void>
  deleteAppliance(id: string): Promise<void>
  getAppliance(id: string): Appliance | undefined
  forecastedDailyCost: number

  totalDailyUsage: number
  totalDailyCost: number
  yearlyCarbonFootprint: number
  estimatedAnnualSavings: number

  settings: UserSettings
  updateSettings(updates: Partial<UserSettings>): void
  appMode: AppMode
  setAppMode(mode: AppMode): void

  costFromKwh(kwh: number): number
  convertCurrency(usd: number): number
  formatCost(usd: number): string
  formatConvertedCost(val: number): string
  symbol: '$' | '€'
  currentRate: number

  logManualUsage(log: UsageLog): void
  getApplianceTypeInfo(type: string): { averageWattage: number } | undefined
  fetchLiveRate(toCurrency: 'USD' | 'EUR'): Promise<number>

  dailyUsageSeries: UsageLog[]
}

const AppContext = createContext<AppContextType | undefined>(undefined)

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [appliances, setAppliances] = useState<Appliance[]>(() => {
    try {
      const saved = localStorage.getItem('appliances')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const saved = localStorage.getItem('settings')
      return saved
        ? JSON.parse(saved)
        : {
            currency: 'USD',
            householdSize: 2,
            darkMode: false,
            electricityRate: 0.17,
            exchangeRate: DEFAULT_USD_TO_EUR,
          }
    } catch {
      return {
        currency: 'USD',
        householdSize: 2,
        darkMode: false,
        electricityRate: 0.17,
        exchangeRate: DEFAULT_USD_TO_EUR,
      }
    }
  })

  const [appMode, setAppMode] = useState<AppMode>(() => {
    const savedMode = localStorage.getItem('appMode')
    return savedMode === 'live' ? 'live' : 'simulated'
  })

  const [manualUsageLog, setManualUsageLog] = useState<UsageLog[]>(() => {
    try {
      const saved = localStorage.getItem('manualUsageLog')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('appliances', JSON.stringify(appliances))
  }, [appliances])

  useEffect(() => {
    localStorage.setItem('settings', JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    localStorage.setItem('appMode', appMode)
  }, [appMode])

  useEffect(() => {
    localStorage.setItem('manualUsageLog', JSON.stringify(manualUsageLog))
  }, [manualUsageLog])

  useEffect(() => {
    if (!getAuthToken()) setAppMode('simulated')
  }, [])

  useEffect(() => {
    const fetchAppliances = async () => {
      if (appMode === 'live') {
        try {
          const res = await fetch(API_URL, {
            headers: { Authorization: `Bearer ${getAuthToken()}` },
          })
          if (res.ok) {
            const data: Appliance[] = await res.json()
            setAppliances(data)
          }
        } catch (err) {
          console.error('Failed to fetch appliances:', err)
        }
      }
    }
    fetchAppliances()
  }, [appMode])

  const [fxRate, setFxRate] = useState<number>(settings.exchangeRate)
  useEffect(() => {
    setFxRate(settings.currency === 'EUR' ? settings.exchangeRate : 1)
  }, [settings.currency, settings.exchangeRate])

  const usdRate = settings.electricityRate
  const currencyRate = settings.currency === 'EUR' ? fxRate : 1
  const currentRate = usdRate * currencyRate

  const costFromKwh = useCallback((kwh: number) => kwh * currentRate, [currentRate])
  const convertCurrency = useCallback((usd: number) => usd * currencyRate, [currencyRate])

  const symbol = useMemo(() => (settings.currency === 'EUR' ? '€' : '$'), [settings.currency])

  const currencyFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: settings.currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    [settings.currency]
  )

  const formatCost = useCallback(
    (usd: number) => currencyFormatter.format(usd * currencyRate),
    [currencyFormatter, currencyRate]
  )
  const formatConvertedCost = useCallback(
    (val: number) => currencyFormatter.format(val),
    [currencyFormatter]
  )

  const fetchLiveRate = useCallback(async (toCurrency: 'USD' | 'EUR') => {
    if (toCurrency === 'USD') return 1
    try {
      const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=EUR')
      const json = await res.json()
      return json.rates.EUR ?? DEFAULT_USD_TO_EUR
    } catch {
      return DEFAULT_USD_TO_EUR
    }
  }, [])

  const totalDailyUsage = useMemo(
    () => appliances.reduce(
      (sum, app) => sum + (app.wattage * app.hoursPerDay * app.daysPerWeek) / 7 / 1000,
      0
    ), [appliances]
  )

  const forecastedDailyCost = useMemo(() => {
    const points = generateEstimate({ appliances, convertCost: costFromKwh, count: 30, daysPer: 1, disableNoise: false,
      getApplianceTypeInfo: type => applianceDatabase[type]
        ? { averageWattage: applianceDatabase[type].defaultWattage }
        : {},
    })
    const total = points.reduce((sum, p) => sum + (p.total ?? 0), 0)
    return total / 30
  }, [appliances, costFromKwh])

  const totalDailyCost = useMemo(() => costFromKwh(totalDailyUsage), [totalDailyUsage, costFromKwh])
  const yearlyCarbonFootprint = useMemo(
    () => totalDailyUsage * 365 * EMISSION_FACTOR_KG_PER_KWH,
    [totalDailyUsage]
  )
  const estimatedAnnualSavings = useMemo(
    () => totalDailyCost * 365 * SAVINGS_PERCENTAGE,
    [totalDailyCost]
  )

  const dailyUsageSeries = useMemo(
    () => [...manualUsageLog].sort((a, b) => a.date.localeCompare(b.date)),
    [manualUsageLog]
  )

  const addAppliance = async (input: ApplianceInput) => {
    const newApp: Appliance = { ...input, id: crypto.randomUUID?.() || Math.random().toString(36).slice(2) }
    if (appMode === 'live') {
      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
          body: JSON.stringify(newApp),
        })
        if (!res.ok) throw new Error('Failed to add appliance')
        const saved: Appliance = await res.json()
        setAppliances(prev => [saved, ...prev])
        return
      } catch (err) { console.error(err) }
    }
    setAppliances(prev => [newApp, ...prev])
  }

  const updateAppliance = async (updated: Appliance) => {
    if (appMode === 'live') {
      try {
        const res = await fetch(`${API_URL}/${updated.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getAuthToken()}` },
          body: JSON.stringify(updated),
        })
        if (!res.ok) throw new Error('Failed to update appliance')
      } catch (err) { console.error(err) }
    }
    setAppliances(prev => prev.map(a => (a.id === updated.id ? updated : a)))
  }

  const deleteAppliance = async (id: string) => {
    if (appMode === 'live') {
      try {
        await fetch(`${API_URL}/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getAuthToken()}` } })
      } catch (err) { console.error(err) }
    }
    setAppliances(prev => prev.filter(a => a.id !== id))
  }

  return (
    <AppContext.Provider
      value={{ appliances, addAppliance, updateAppliance, deleteAppliance, getAppliance: id => appliances.find(a => a.id === id), forecastedDailyCost,
        totalDailyUsage, totalDailyCost, yearlyCarbonFootprint, estimatedAnnualSavings,
        settings, updateSettings: u => setSettings(prev => ({ ...prev, ...u })), appMode, setAppMode,
        costFromKwh, convertCurrency, formatCost, formatConvertedCost, symbol, currentRate,
        logManualUsage: log => setManualUsageLog(prev => [...prev.filter(e => e.date !== log.date), log].sort((a, b) => a.date.localeCompare(b.date))),
        getApplianceTypeInfo: type => applianceDatabase[type] ? { averageWattage: applianceDatabase[type].defaultWattage } : undefined,
        fetchLiveRate, dailyUsageSeries
      }}>
      {children}
    </AppContext.Provider>
  )
}

export const useAppContext = () => { const ctx = useContext(AppContext); if (!ctx) throw new Error('useAppContext must be used within AppProvider'); return ctx }
