// src/components/UsageSummary.tsx
import { useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import EnergyTip from './EnergyTip'
import { illustrativeReferenceEstimates } from '../data/applianceDatabase'
import {
  Lightbulb,
  DollarSign,
  Zap,
  TrendingDown,
  Info,
} from 'lucide-react'

type UsageSummaryProps = {
  avgDailyCostFromChart?: number | null // already in user currency
  costAvailabilityMessage?: string | null
}

export default function UsageSummary({
  avgDailyCostFromChart = null,
  costAvailabilityMessage = null,
}: UsageSummaryProps) {
  const {
    trackedAppliances,
    settings,
    totalDailyUsage,
    formatCost,
  } = useAppContext()

  // Bundled illustrative static reference for household size.
  const baselineDaily = useMemo(() => {
    const bySize = illustrativeReferenceEstimates.by_household_size
    const sizeKey = settings.householdSize >= 5 ? 5 : settings.householdSize
    return bySize[sizeKey] ?? illustrativeReferenceEstimates.daily
  }, [settings.householdSize])

  // Negative means the formula estimate is below the static reference.
  const differenceFromReference = useMemo(() => {
    if (!trackedAppliances.length || !Number.isFinite(totalDailyUsage) || !Number.isFinite(baselineDaily) || baselineDaily <= 0) return null
    const rawScore = ((totalDailyUsage - baselineDaily) / baselineDaily) * 100
    const clampedScore = Math.max(-999, Math.min(999, rawScore))
    return Number(clampedScore.toFixed(1))
  }, [baselineDaily, totalDailyUsage, trackedAppliances.length])

  const [showTooltip, setShowTooltip] = useState(false)

  const displayedCost =
    typeof avgDailyCostFromChart === 'number' && Number.isFinite(avgDailyCostFromChart)
      ? avgDailyCostFromChart
      : null
  const formattedCost = displayedCost === null
    ? costAvailabilityMessage ?? 'No active appliances'
    : formatCost(displayedCost)

  const getDifferenceColor = (score: number | null) => {
    if (score === null) return 'text-gray-400'
    if (score <= -10) return 'text-green-600 dark:text-green-400'
    if (score <= 0) return 'text-yellow-600 dark:text-yellow-400'
    return 'text-red-600 dark:text-red-400'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Daily Usage */}
      <div className="card card-interactive fade-in-up stagger-1 bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Estimated Daily Usage · Formula Estimate
          </h3>
          <Lightbulb className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {totalDailyUsage.toFixed(2)} kWh
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Static {settings.householdSize}-person reference estimate: {baselineDaily.toFixed(2)} kWh/day
        </p>
      </div>

      {/* Estimated daily cost */}
      <div className="card card-interactive fade-in-up stagger-2 bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Daily Cost · Formula Estimate
          </h3>
          <DollarSign className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {formattedCost}
        </p>
      </div>

      {/* Difference from bundled reference */}
      <div className="relative card card-interactive fade-in-up stagger-3 bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
            Estimated Difference from Reference
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
            Negative values mean the Formula Estimate is below this bundled static reference. Positive values mean it is above it. This is not an efficiency rating or energy audit.
          </div>
        )}

        {differenceFromReference === null ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Reference unavailable
          </p>
        ) : (
          <p className={`mt-2 text-2xl font-semibold ${getDifferenceColor(differenceFromReference)}`}>
            {differenceFromReference > 0 ? '+' : ''}
            {differenceFromReference.toFixed(1)}%
          </p>
        )}

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          EnergyIQ bundled illustrative planning assumption—not measured data
        </p>
      </div>

      {/* Energy Tip */}
      <div className="card card-interactive fade-in-up stagger-4 bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
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
