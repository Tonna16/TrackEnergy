import { useEffect, useRef, useState, useMemo } from 'react'
import { useAppContext, Appliance } from '../context/AppContext'
import EnergyUsageChart from '../components/EnergyUsageChart'
import { Info } from 'lucide-react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { useNotificationsCtx } from '../context/NotificationsContext'
import { estimateAnnualFromAppliances } from '../utils/energyEstimator'
import { formatCurrency } from '../utils/formatCurrency'

const DEFAULT_CO2_FACTOR = 0.92 // kg CO₂ per kWh

function formatNumber(num: number) {
  return num.toFixed(2)
}

function getStartOfWeek(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

function useWeeklyComparison(
  appliances: Appliance[],
  electricityRate: number,
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
    if (!isLoggedIn) {
      // Guest: use fallback prediction only, no actual data
      const fallbackKwh = appliances.reduce((sum, a) => {
        const avgW = getApplianceTypeInfo?.(a.type)?.averageWattage ?? a.wattage
        const wattage = a.isHighEfficiency ? avgW * 0.8 : avgW
        const dailyKwh = (wattage * a.hoursPerDay * a.daysPerWeek) / 7 / 1000
        return sum + dailyKwh * 7
      }, 0)
      setActual('insufficient')
      setPredicted(fallbackKwh)
      setUsedFallback(true)
      return
    }

    // Logged in — fetch actual usage
    api
      .get<{ kWhUsed: number }[]>('energy-usage', {
        params: { startDate: getStartOfWeek() },
      })
      .then(res => {
        if (res.data.length > 0) {
          const total = res.data.reduce((sum, e) => sum + e.kWhUsed, 0)
          setActual(total)
        } else {
          setActual('insufficient')
        }
      })
      .catch(() => setActual('insufficient'))

    // Fetch predicted usage from backend projections
    api
      .get<{ totalCost: number }[]>('energy-usage/projections', {
        params: { timeRange: 'weekly' },
      })
      .then(res => {
        if (res.data.length > 0 && typeof res.data[0].totalCost === 'number') {
          setPredicted(res.data[0].totalCost / electricityRate)
          setUsedFallback(false)
        } else {
          throw new Error('Fallback')
        }
      })
      .catch(() => {
        // fallback to estimate
        const fallbackKwh = appliances.reduce((sum, a) => {
          const avgW = getApplianceTypeInfo?.(a.type)?.averageWattage ?? a.wattage
          const wattage = a.isHighEfficiency ? avgW * 0.8 : avgW
          const dailyKwh = (wattage * a.hoursPerDay * a.daysPerWeek) / 7 / 1000
          return sum + dailyKwh * 7
        }, 0)
        setPredicted(fallbackKwh)
        setUsedFallback(true)
      })
  }, [appliances, electricityRate, getApplianceTypeInfo, isLoggedIn])

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
  const {
    addNotification,
    notifyForecastMode,
    notifyHighUsageAppliance,
  } = useNotificationsCtx()

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

  const safeGetApplianceTypeInfo = (type: string) => getApplianceTypeInfo(type) || {}

  // Weekly kWh vs forecast
  const { actual, predicted, usedFallback } = useWeeklyComparison(
    appliances,
    settings.electricityRate,
    safeGetApplianceTypeInfo,
    isLoggedIn
  )

  const needFallback = forecastedAnnualCost == null || forecastedAnnualCost <= 0

  // Fetch 30-day summary & annual-cost from backend or fallback for guests
  useEffect(() => {
    if (!isLoggedIn) {
      // Guest mode - no backend, clear summary & forecast to use fallback
      setSummary(null)
      setForecastedAnnualCost(null)
      return
    }

    // Logged-in user mode: fetch summary & annual cost
    api
      .get<{
        totalKwh: number
        totalCost: number
        averageDailyUsage: number
      }>('energy-usage/summary', { params: { days: 30 } })
      .then(res => setSummary(res.data))
      .catch(() => setSummary(null))

    api
      .get<{ annualCost: number }>('energy-usage/annual-cost')
      .then(res => {
        const converted = convertCurrency(res.data.annualCost)
        setForecastedAnnualCost(converted)

        if (prevCurrency.current !== settings.currency) {
          addNotification({
            type: 'info',
            title: `Currency switched to ${settings.currency}`,
            message: `All cost forecasts now show ${settings.currency} rates.`,
          })
          prevCurrency.current = settings.currency
        }
      })
      .catch(() => setForecastedAnnualCost(null))
  }, [settings.currency, settings.exchangeRate, addNotification, convertCurrency, isLoggedIn])

  // Fallback annual estimate
  const fallback = useMemo(() => {
    if (!needFallback) return null
    return estimateAnnualFromAppliances({
      appliances,
      electricityRate: settings.electricityRate,
      getApplianceTypeInfo: safeGetApplianceTypeInfo,
      convertCost: costFromKwh,
    })
  }, [needFallback, appliances, settings.electricityRate, costFromKwh, getApplianceTypeInfo])

  // Compute display values
  const avgDailyUsage = summary?.averageDailyUsage ?? totalDailyUsage
  const annualCost = needFallback
    ? fallback?.annualCost ?? NaN
    : forecastedAnnualCost ?? NaN
  const annualCarbon = needFallback
    ? fallback?.annualCarbon ?? 0
    : avgDailyUsage * 365 * DEFAULT_CO2_FACTOR

  // Notify when switching from fallback to advanced (only logged in)
  useEffect(() => {
    if (
      prevUsedFallback.current === true &&
      usedFallback === false &&
      isLoggedIn
    ) {
      notifyForecastMode('advanced').catch(console.error)
    }
    prevUsedFallback.current = usedFallback
  }, [usedFallback, notifyForecastMode, isLoggedIn])

  // Track “high-usage” appliances & send notifications (only logged in)
  const appliancesByUsage = useMemo(
    () =>
      appliances
        .map(a => {
          const avgW = getApplianceTypeInfo(a.type)?.averageWattage ?? a.wattage
          const usage = (a.wattage * a.hoursPerDay * a.daysPerWeek) / 7 / 1000
          const avgUsage = (avgW * a.hoursPerDay * a.daysPerWeek) / 7 / 1000
          return { name: a.name, usage, avgUsage }
        })
        .sort((x, y) => y.usage - x.usage),
    [appliances, getApplianceTypeInfo]
  )

  useEffect(() => {
    if (!isLoggedIn) return

    if (isFirstHighUsageRun.current) {
      prevHighRef.current = appliancesByUsage
        .filter(u => u.usage > u.avgUsage)
        .map(u => u.name)
      isFirstHighUsageRun.current = false
      return
    }

    const currentlyHigh = appliancesByUsage
      .filter(u => u.usage > u.avgUsage)
      .map(u => u.name)

    // Send “back to normal” alerts
    prevHighRef.current.forEach(name => {
      if (!currentlyHigh.includes(name)) {
        addNotification({
          type: 'success',
          title: 'Good news!',
          message: `${name} is no longer above average energy usage.`,
        })
      }
    })

    // Send new high-usage alerts
    currentlyHigh.forEach(name => {
      if (!prevHighRef.current.includes(name)) {
        const app = appliances.find(a => a.name === name)!
        const estKwh = (app.wattage * app.hoursPerDay * app.daysPerWeek) / 7 / 1000
        notifyHighUsageAppliance(name, estKwh).catch(console.error)
      }
    })

    prevHighRef.current = currentlyHigh
  }, [appliancesByUsage, addNotification, notifyHighUsageAppliance, appliances, isLoggedIn])

  // Weekly vs forecast notification (only logged in)
  useEffect(() => {
    if (
      typeof actual === 'number' &&
      typeof predicted === 'number' &&
      isLoggedIn
    ) {
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

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
        Energy Insights
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h2>Daily Energy Usage</h2>
          <p className="text-2xl font-semibold mt-1">
            {formatNumber(avgDailyUsage)} kWh
          </p>
        </div>
        <div className="card">
          <h2>
            Annual Cost <InfoTooltip text="Based on 30‑day trends & fallback" />
          </h2>
          <p className="text-2xl font-semibold mt-1">
            {isNaN(annualCost)
              ? '—'
              : formatCurrency(annualCost, settings.currency)}
          </p>
        </div>
        <div className="card">
          <h2>
            Carbon Footprint <InfoTooltip text="0.92 kg CO₂/kWh" />
          </h2>
          <p className="text-2xl font-semibold mt-1">
            {formatNumber(annualCarbon)} kg CO₂
          </p>
        </div>
      </div>

      <div className="card">
        <h2 className="font-medium mb-4">Your Energy Trends</h2>
        <EnergyUsageChart useEstimate={needFallback} />
      </div>
    </div>
  )
}
