// src/pages/Insights.tsx
import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useAppContext, Appliance } from '../context/AppContext'
import EnergyUsageChart from '../components/EnergyUsageChart'
import { Info } from 'lucide-react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { useNotificationsCtx } from '../context/NotificationsContext'
import { estimateAnnualFromAppliances, getKwhPerDay, getKwhPerWeek } from '../utils/energyEstimator'
import { formatCurrency } from '../utils/formatCurrency'
import TopConsumers from '../components/TopConsumers'
import WeeklyForecastCard from '../components/WeeklyForecastCard'
const DEFAULT_CO2_FACTOR = 0.92 // kg CO₂ per kWh

function formatNumber(num: number) {
  return num.toFixed(2)
}

function getStartOfWeek(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Monday as start
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

function useWeeklyComparison(
  appliances: Appliance[],
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number },
  isLoggedIn: boolean = false
): {
  actual: number | 'insufficient' | null
  predicted: number | 'insufficient' | null
  usedFallback: boolean
} {
  const [actual, setActual] = useState<number | 'insufficient' | null>(null)
  const [predicted, setPredicted] = useState<number | 'insufficient' | null>(null)
  const [usedFallback, setUsedFallback] = useState(false)

  useEffect(() => {
    let cancelled = false

    const computeClientFallbackKwh = () =>
      appliances.reduce<number>((sum, a) => {
        return sum + getKwhPerWeek(a, getApplianceTypeInfo)
      }, 0)

    const fetchData = async () => {
      if (!isLoggedIn) {
        const fallbackKwh = computeClientFallbackKwh()
        if (!cancelled) {
          setActual('insufficient')
          setPredicted(fallbackKwh)
          setUsedFallback(true)
        }
        return
      }

      // Authenticated: fetch actual usage
      try {
        const res = await api.get<{ kWhUsed?: number }[]>('energy-usage', {
          params: { startDate: getStartOfWeek() },
        })
        if (!cancelled) {
          if (Array.isArray(res.data) && res.data.length > 0) {
            const total = res.data.reduce<number>((sum, e) => sum + (e.kWhUsed ?? 0), 0)
            setActual(total)
          } else {
            setActual('insufficient')
          }
        }
      } catch (err) {
        if (!cancelled) setActual('insufficient')
      }

      try {
        const resProj = await api.get<{ totalKwh?: number; totalCost?: number }[]>('energy-usage/projections', {
          params: { timeRange: 'weekly' },
        })
        if (cancelled) return

        const arr = Array.isArray(resProj.data) ? resProj.data : []
        if (arr.length > 0 && typeof arr[0].totalKwh === 'number') {
          setPredicted(arr[0].totalKwh)
          setUsedFallback(false)
        } else {
          // fallback
          const fallbackKwh = computeClientFallbackKwh()
          setPredicted(fallbackKwh)
          setUsedFallback(true)
        }
      } catch (err) {
        if (!cancelled) {
          const fallbackKwh = computeClientFallbackKwh()
          setPredicted(fallbackKwh)
          setUsedFallback(true)
        }
      }
    }

    fetchData()
    return () => {
      cancelled = true
    }
  }, [appliances, getApplianceTypeInfo, isLoggedIn])

  return { actual, predicted, usedFallback }
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="relative inline-block group" tabIndex={0}>
      <Info className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-pointer" />
      <div
        role="tooltip"
        className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2 hidden group-hover:block group-focus:block
          bg-gray-700 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap"
      >
        {text}
      </div>
    </div>
  )
}

export default function Insights() {
  const {
    appliances,
    totalDailyUsage,
    settings,
    getApplianceTypeInfo,
    costFromKwh,
    convertCurrency,
  } = useAppContext()
  const { addNotification, notifyForecastMode, notifyHighUsageAppliance } = useNotificationsCtx()

  const isLoggedIn = Boolean(getAuthToken())

  const [summary, setSummary] = useState<{
    totalKwh: number
    totalCost: number
    averageDailyUsage: number
  } | null>(null)
  const [forecastedAnnualCost, setForecastedAnnualCost] = useState<number | null>(null)

  const prevUsedFallback = useRef<boolean | null>(null)
  const prevHighRef = useRef<string[]>([])
  const prevCurrency = useRef(settings.currency)
  const isFirstHighUsageRun = useRef(true)

  const safeGetApplianceTypeInfo = useCallback((type: string) => getApplianceTypeInfo(type) || {}, [getApplianceTypeInfo])

  // Weekly comparison
  const { actual, predicted, usedFallback } = useWeeklyComparison(
    appliances,
    safeGetApplianceTypeInfo,
    isLoggedIn
  )

  const needFallback = forecastedAnnualCost == null || forecastedAnnualCost <= 0

  // Fetch summary & annual cost (only when logged in). Guests will fall back to estimate below.
  useEffect(() => {
    let cancelled = false

    const fetchSummaryAndAnnual = async () => {
      if (!isLoggedIn) {
        if (!cancelled) {
          setSummary(null)
          setForecastedAnnualCost(null)
        }
        return
      }

      // Summary
      try {
        const res = await api.get<{
          totalKwh?: number
          totalCost?: number
          averageDailyUsage?: number
        }>('energy-usage/summary', { params: { days: 30 } })
        if (!cancelled) setSummary((res.data as any) ?? null)
      } catch (err) {
        if (!cancelled) {
          console.error('[Insights] Failed to fetch summary:', err)
          setSummary(null)
        }
      }

  // inside the fetchSummaryAndAnnual() try { ... } for annual cost
// inside fetchSummaryAndAnnual()
try {
  const resAnnual = await api.get<{ annualCost?: number }>('energy-usage/annual-cost');
  if (cancelled) return;

  const raw = resAnnual.data?.annualCost;
  console.debug('[Insights] annual-cost raw response:', resAnnual.data);

  if (typeof raw === 'number') {
    // Use context convertCurrency to convert backend USD -> selected currency
    const converted = convertCurrency(raw);
    if (Number.isFinite(converted)) {
      setForecastedAnnualCost(converted);
      console.debug('[Insights] forecastedAnnualCost set to', converted);
    } else {
      console.warn('[Insights] converted annual cost not finite:', converted);
      setForecastedAnnualCost(null);
    }

    if (prevCurrency.current !== settings.currency) {
      addNotification({
        type: 'info',
        title: `Currency switched to ${settings.currency}`,
        message: `All cost forecasts now show ${settings.currency} rates.`,
      });
      prevCurrency.current = settings.currency;
    }
  } else {
    setForecastedAnnualCost(null);
  }
} catch (err) {
  if (!cancelled) {
    console.error('[Insights] Failed to fetch annual cost:', err);
    setForecastedAnnualCost(null);
  }
}

    }
    fetchSummaryAndAnnual()
    return () => {
      cancelled = true
    }
  }, [settings.currency, settings.exchangeRate, addNotification, isLoggedIn])

  // Fallback annual estimate computed from appliances
  const fallback = useMemo(() => {
    if (!needFallback) return null
    return estimateAnnualFromAppliances({
      appliances,
      electricityRate: settings.electricityRate,
      getApplianceTypeInfo: safeGetApplianceTypeInfo,
      convertCost: costFromKwh,
    })
  }, [needFallback, appliances, settings.electricityRate, costFromKwh, safeGetApplianceTypeInfo])

  // display values
  const avgDailyUsage = summary?.averageDailyUsage ?? totalDailyUsage
  const annualCost = needFallback ? fallback?.annualCost ?? NaN : forecastedAnnualCost ?? NaN
  const annualCarbon = needFallback ? fallback?.annualCarbon ?? 0 : avgDailyUsage * 365 * DEFAULT_CO2_FACTOR

  // notifications + high-usage logic unchanged
  useEffect(() => {
    if (prevUsedFallback.current === true && usedFallback === false && isLoggedIn) {
      notifyForecastMode('advanced').catch(console.error)
    }
    prevUsedFallback.current = usedFallback
  }, [usedFallback, notifyForecastMode, isLoggedIn])

  const appliancesByUsage = useMemo(
    () =>
      appliances
        .map(a => {
          const avgW = getApplianceTypeInfo(a.type)?.averageWattage ?? a.wattage
          const usage = getKwhPerDay(a)
          const avgUsage = getKwhPerDay(
            { ...a, isHighEfficiency: false },
            () => ({ averageWattage: avgW })
          )
          return { name: a.name, usage, avgUsage }
        })
        .sort((x, y) => y.usage - x.usage),
    [appliances, getApplianceTypeInfo]
  )

  useEffect(() => {
    if (!isLoggedIn) return

    if (isFirstHighUsageRun.current) {
      prevHighRef.current = appliancesByUsage.filter(u => u.usage > u.avgUsage).map(u => u.name)
      isFirstHighUsageRun.current = false
      return
    }

    const currentlyHigh = appliancesByUsage.filter(u => u.usage > u.avgUsage).map(u => u.name)

    prevHighRef.current.forEach(name => {
      if (!currentlyHigh.includes(name)) {
        addNotification({
          type: 'success',
          title: 'Good news!',
          message: `${name} is no longer above average energy usage.`,
        })
      }
    })

    currentlyHigh.forEach(name => {
      if (!prevHighRef.current.includes(name)) {
        const app = appliances.find(a => a.name === name)!
        const estKwh = getKwhPerDay(app, safeGetApplianceTypeInfo)
        notifyHighUsageAppliance(name, estKwh).catch(console.error)
      }
    })

    prevHighRef.current = currentlyHigh
  }, [appliancesByUsage, addNotification, notifyHighUsageAppliance, appliances, isLoggedIn])

  useEffect(() => {
    if (typeof actual === 'number' && typeof predicted === 'number' && isLoggedIn) {
      addNotification({
        weekStartDate: getStartOfWeek(),
        actualUsage: actual,
        forecastUsage: predicted,
        type: actual > predicted ? 'warning' : 'success',
        title: 'Weekly Usage vs Forecast',
        message:
          actual > predicted
            ? `You used ${formatNumber(actual - predicted)} kWh more than forecast.`
            : `You used ${formatNumber(predicted - actual)} kWh less than forecast!`,
      })
    }
  }, [actual, predicted, addNotification, isLoggedIn])

  if (!needFallback && summary === null && isLoggedIn) {
    return <div className="text-center text-gray-600 mt-10">Loading insights…</div>
  }
  console.log("annualCost:", annualCost, "currency:", settings.currency);

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Energy Insights</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
          <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">Daily Energy Usage</h2>
          <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">{formatNumber(avgDailyUsage)} kWh</p>
        </div>

        <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
          <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Annual Cost <InfoTooltip text="Based on 30-day trends & fallback" />
          </h2>
          <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">
            {/* show dash only when we truly don't have a number or currency setting */}
            {Number.isFinite(annualCost) ? formatCurrency(annualCost, settings.currency ?? 'USD') : '—'}


          </p>
        </div>

        <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
          <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">
            Carbon Footprint <InfoTooltip text="0.92 kg CO₂/kWh" />
          </h2>
          <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">{formatNumber(annualCarbon)} kg CO₂</p>
        </div>
      </div>

      <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg mt-4">
        <TopConsumers topN={5} />
      </div>
      {isLoggedIn && (
  <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg mt-4">
    <WeeklyForecastCard />
  </div>
)}


      <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg mt-4">
        <h2 className="font-medium mb-4 text-gray-700 dark:text-gray-300">Your Energy Trends</h2>
        <EnergyUsageChart useEstimate={needFallback} />
      </div>
    </div>
  )
}
