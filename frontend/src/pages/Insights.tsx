// src/pages/Insights.tsx
import { useAppContext } from '../context/AppContext'
import EnergyUsageChart from '../components/EnergyUsageChart'
import { AlertCircle, Info } from 'lucide-react'
import { useMemo, useEffect, useState } from 'react'
import api from '../utils/api'

// Emission factor fallback if API summary unavailable
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

function useWeeklyComparison() {
  const [actual, setActual] = useState<number | 'insufficient' | null>(null)
  const [predicted, setPredicted] = useState<number | 'insufficient' | null>(null)

  useEffect(() => {
    console.log('[Insights] Fetching weekly projections…')
    api
      .get<{ totalCost: number }[]>('/energy-usage/projections', {
        params: { timeRange: 'weekly' },
      })
      .then(res => {
        console.log('[Insights] weekly projections response:', res.data)
        if (res.data.length > 0 && typeof res.data[0].totalCost === 'number') {
          setPredicted(res.data[0].totalCost)
        } else {
          setPredicted('insufficient')
        }
      })
      .catch(err => {
        console.error('[Insights] Error fetching weekly projections:', err)
        setPredicted('insufficient')
      })

    console.log('[Insights] Fetching actual usage since', getStartOfWeek())
    api
      .get<{ kWhUsed: number }[]>('/energy-usage', {
        params: { startDate: getStartOfWeek() },
      })
      .then(res => {
        console.log('[Insights] actual usage response:', res.data)
        if (res.data.length > 0) {
          const total = res.data.reduce((sum, e) => sum + e.kWhUsed, 0)
          setActual(total)
        } else {
          setActual('insufficient')
        }
      })
      .catch(err => {
        console.error('[Insights] Error fetching actual usage:', err)
        setActual('insufficient')
      })
  }, [])

  return { actual, predicted }
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <div className="relative inline-block group" tabIndex={0} aria-describedby="tooltip">
      <Info className="h-4 w-4 text-gray-400 dark:text-gray-500 cursor-pointer" />
      <div
        id="tooltip"
        role="tooltip"
        className="absolute bottom-full mb-1 left-1/2 transform -translate-x-1/2
            hidden group-hover:block group-focus:block
            bg-gray-700 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap"
      >
        {text}
      </div>
    </div>
  )
}

export default function Insights() {
  const { appliances, totalDailyUsage, totalDailyCost, settings, getApplianceTypeInfo } =
    useAppContext()

  const [summary, setSummary] = useState<{
    totalKwh: number
    totalCost: number
    averageDailyUsage: number
  } | null>(null)
  const [forecastedAnnualCost, setForecastedAnnualCost] = useState<number | null>(null)

  // Fetch summary & annual cost
  useEffect(() => {
    console.log('[Insights] Fetching 30-day summary…')
    api
      .get<{
        totalKwh: number
        totalCost: number
        averageDailyUsage: number
      }>('/energy-usage/summary', { params: { days: 30 } })
      .then(res => {
        console.log('[Insights] summary response:', res.data)
        setSummary(res.data)
      })
      .catch(err => {
        console.error('[Insights] Error fetching summary:', err)
        setSummary(null)
      })

    console.log('[Insights] Fetching annual cost forecast…')
    api
      .get<{ annualCost: number }>('/energy-usage/annual-cost')
      .then(res => {
        console.log('[Insights] annual cost response:', res.data)
        setForecastedAnnualCost(res.data.annualCost)
      })
      .catch(err => {
        console.error('[Insights] Error fetching annual cost forecast:', err)
        setForecastedAnnualCost(null)
      })
  }, [settings.currency])

  // Fallback logic
  const avgDailyUsage = summary?.averageDailyUsage ?? totalDailyUsage
  const annualCost = forecastedAnnualCost ?? totalDailyCost * 365
  const annualCarbon = avgDailyUsage * 365 * DEFAULT_CO2_FACTOR

  // Build & sort appliance list
  const appliancesByUsage = useMemo(() => {
    return appliances
      .map(app => {
        const usage = (app.wattage * app.hoursPerDay * app.daysPerWeek) / 7 / 1000
        const avgWattage = getApplianceTypeInfo(app.type)?.averageWattage ?? app.wattage
        const avgUsage = (avgWattage * app.hoursPerDay * app.daysPerWeek) / 7 / 1000
        return { app, usage, avgUsage }
      })
      .sort((a, b) => b.usage - a.usage)
  }, [appliances, getApplianceTypeInfo])

  const { actual, predicted } = useWeeklyComparison()

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Energy Insights</h1>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Daily Usage */}
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400">Daily Energy Usage</h2>
          <p className="text-2xl font-semibold mt-1">{formatNumber(avgDailyUsage)} kWh</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {avgDailyUsage > 10 ? 'Above' : 'Below'} average for your household size
          </p>
        </div>

        {/* Carbon Footprint */}
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Carbon Footprint
            <InfoTooltip text="Calculated using a 0.92 kg CO₂/kWh emission factor." />
          </h2>
          <p className="text-2xl font-semibold mt-1">{formatNumber(annualCarbon)} kg CO₂</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Estimated annual emissions from your electricity use
          </p>
        </div>

        {/* Annual Cost */}
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
            Annual Cost Estimate
            <InfoTooltip text="Based on recent usage trends and current currency rate." />
          </h2>
          <p className="text-2xl font-semibold mt-1">
            {settings.currency === 'USD' ? '$' : '€'}
            {formatNumber(annualCost)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Based on your {summary ? 'actual' : 'estimated'} usage patterns
          </p>
          {forecastedAnnualCost === null && (
            <p className="text-xs text-red-500 mt-1">
              Unable to load forecasted cost – using fallback estimate
            </p>
          )}
        </div>
      </div>

      {/* Top Consumers */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Top Energy Consumers</h2>
        {appliancesByUsage.length > 0 ? (
          <div className="space-y-4">
            {appliancesByUsage.map(({ app, usage, avgUsage }) => (
              <div key={app.id} className="flex items-start">
                <div
                  className={`flex-shrink-0 w-1 min-h-[50px] rounded-full ${
                    usage > avgUsage ? 'bg-red-500' : 'bg-gray-300'
                  }`}
                />
                <div className="ml-4 flex-1">
                  <div className="flex justify-between">
                    <h3 className="font-medium">{app.name}</h3>
                    <p className="font-medium">{formatNumber(usage)} kWh/day</p>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {app.wattage} W • {app.hoursPerDay} hrs/day
                  </p>
                  {usage > avgUsage && (
                    <div className="mt-2 text-sm bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 p-2 rounded-lg">
                      <AlertCircle className="h-4 w-4 mr-1 inline-block" />
                      <span className="font-medium">
                        Energy hog alert: uses {formatNumber(Math.abs(usage - avgUsage))} kWh/day above average.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Add appliances to see your top energy consumers
          </p>
        )}
      </div>

      {/* Forecast vs Actual */}
      <div className="card">
        <h2 className="text-lg font-medium mb-1">Forecast vs Actual (This Week)</h2>
        {actual != null && predicted != null && actual !== 'insufficient' && predicted !== 'insufficient' ? (
          <>
            <div className="grid grid-cols-2 gap-4 text-sm mb-2">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Actual</p>
                <p className="text-xl font-semibold text-blue-600 dark:text-blue-400">
                  {formatNumber(actual)} kWh
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Predicted</p>
                <p className="text-xl font-semibold text-indigo-600 dark:text-indigo-400">
                  {formatNumber(predicted)} kWh
                </p>
              </div>
            </div>
            <p className={`mt-2 text-sm font-medium ${actual > predicted ? 'text-red-600' : 'text-green-600'}`}>
              {actual > predicted
                ? `Above forecast by ${formatNumber(actual - predicted)} kWh`
                : `Below forecast by ${formatNumber(predicted - actual)} kWh`}
            </p>
          </>
        ) : (
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            We need more data to show weekly insights. Log a few days of usage, then revisit.
          </p>
        )}
      </div>

      {/* Trends */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Your Energy Trends</h2>
        <EnergyUsageChart useEstimate={false} />
      </div>
    </div>
  )
}
