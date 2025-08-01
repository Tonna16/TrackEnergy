// src/components/UsageSummary.tsx
import React, { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import EnergyTip from './EnergyTip'
import { nationalAverages } from '../data/applianceDatabase'
import {
  Lightbulb,
  DollarSign,
  Zap,
  TrendingDown,
  Info,
} from 'lucide-react'

type UsageSummaryProps = {
  avgDailyCostFromChart?: number // already in user currency
}

export default function UsageSummary({ avgDailyCostFromChart = 0 }: UsageSummaryProps) {
  const {
    appliances,
    settings,
    costFromKwh,
    totalDailyUsage,
    forecastedDailyCost
  } = useAppContext()

  // Baseline national average for household size
  const baselineDaily = useMemo(() => {
    const bySize = nationalAverages.by_household_size
    const sizeKey = settings.householdSize >= 5 ? 5 : settings.householdSize
    return bySize[sizeKey] ?? nationalAverages.daily
  }, [settings.householdSize])

  // Efficiency %
  // -1 means no baseline data
  // null means no usage data
  const efficiencyPercent = useMemo(() => {
    if (baselineDaily <= 0) return -1
    if (totalDailyUsage === 0) return null
    const ratio = (baselineDaily - totalDailyUsage) / baselineDaily
    return Math.round(Math.max(0, Math.min(100, ratio * 100)))
  }, [baselineDaily, totalDailyUsage])

  const [showTooltip, setShowTooltip] = useState(false)

  // Use chart average if available; otherwise backend forecast, fallback 0
  const displayedCost = avgDailyCostFromChart > 0 
    ? avgDailyCostFromChart 
    : forecastedDailyCost ?? 0

  const formattedCost = useMemo(() => {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: settings.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(displayedCost ?? 0)
  }, [displayedCost, settings.currency])

  const getEfficiencyColor = (percent: number | null) => {
    if (percent === null || percent < 0) return 'text-gray-400'
    if (percent < 50) return 'text-red-600 dark:text-red-400'
    if (percent <= 80) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-green-600 dark:text-green-400'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Daily Usage */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Daily Usage
          </h3>
          <Lightbulb className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {totalDailyUsage.toFixed(2)} kWh
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          National average: {baselineDaily.toFixed(2)} kWh
        </p>
      </div>

      {/* Forecasted Daily Cost */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Forecasted Daily Cost
          </h3>
          <DollarSign className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {formattedCost}
        </p>
      </div>

      {/* Efficiency */}
      <div className="relative bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
            Efficiency (%)
            <Info
              className="h-4 w-4 ml-1 text-gray-400 cursor-pointer"
              tabIndex={0}
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onFocus={() => setShowTooltip(true)}
              onBlur={() => setShowTooltip(false)}
            />
          </h3>
          <Zap className="h-6 w-6 text-emerald-500" />
        </div>

        {showTooltip && (
          <div className="absolute top-8 left-0 bg-gray-700 text-white text-xs rounded px-3 py-2 w-52 z-10 shadow-lg">
            <div className="absolute -top-2 left-4 w-3 h-3 bg-gray-700 rotate-45" />
            Efficiency compares your daily energy use to the national average for your household size.
          </div>
        )}

        {efficiencyPercent === null ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No exact value</p>
        ) : efficiencyPercent < 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No baseline data</p>
        ) : (
          <p className={`mt-2 text-2xl font-semibold ${getEfficiencyColor(efficiencyPercent)}`}>
            {efficiencyPercent}%
          </p>
        )}

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Compared to {settings.householdSize}-person average
        </p>
      </div>

      {/* Energy Tip */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Energy-Saving Tip
          </h3>
          <TrendingDown className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
          <EnergyTip />
        </p>
      </div>
    </div>
  )
}
