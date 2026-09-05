// src/pages/Compare.tsx
import { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import EnergyUsageChart from '../components/EnergyUsageChart'
import { illustrativeReferenceEstimates } from '../data/applianceDatabase'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { getKwhPerDay } from '../utils/energyEstimator'
import { daysInMonth } from '../utils/energyCalculations'

function formatNumber(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : '0.0'
}

function calculateReferenceDifference(usageValue: number, baselineValue: number, hasAppliances: boolean) {
  if (!hasAppliances || !Number.isFinite(usageValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) return null
  const difference = ((usageValue - baselineValue) / baselineValue) * 100
  return Math.max(-999, Math.min(999, difference))
}

type Bucket = { name: string; value: number }
type ComparisonApiResponse = {
  householdAvg: number
  source: 'local-database' | 'sample'
  isSample: boolean
}
type HouseholdProfileKey = 'balanced' | 'remote-work' | 'large-family' | 'frugal'
type HouseholdScenario = {
  key: HouseholdProfileKey
  label: string
  description: string
  baseKwhPerPerson: number
  householdMultiplier: number
}

const HOUSEHOLD_SCENARIOS: HouseholdScenario[] = [
  {
    key: 'balanced',
    label: 'Balanced Home',
    description: 'Typical weekday + weekend usage for mixed schedules.',
    baseKwhPerPerson: 3.4,
    householdMultiplier: 1,
  },
  {
    key: 'remote-work',
    label: 'Remote Work Family',
    description: 'Higher daytime HVAC, lighting, and device loads.',
    baseKwhPerPerson: 3.9,
    householdMultiplier: 1.08,
  },
  {
    key: 'large-family',
    label: 'Large Active Family',
    description: 'More laundry, cooking, and evening peak demand.',
    baseKwhPerPerson: 4.2,
    householdMultiplier: 1.15,
  },
  {
    key: 'frugal',
    label: 'Lower-Use Assumptions',
    description: 'Conservation habits and efficient appliances.',
    baseKwhPerPerson: 2.9,
    householdMultiplier: 0.86,
  },
]

export default function Compare() {
  const { totalDailyUsage, trackedAppliances, settings, getApplianceTypeInfo, backendEnabled } = useAppContext()
  const [compareWith, setCompareWith] = useState<'national' | 'household' | 'similar'>('national')

  const [loadingReference, setLoadingReference] = useState(false)
  const [referenceError, setReferenceError] = useState<string | null>(null)
  const [referenceData, setReferenceData] = useState<Bucket[] | null>(null)
  const [referenceSource, setReferenceSource] = useState<'local-database' | 'sample'>('sample')
  const [scenarioHouseholdSize, setScenarioHouseholdSize] = useState<number>(2)
  const [scenarioProfile, setScenarioProfile] = useState<HouseholdProfileKey>('balanced')

  const token = backendEnabled && Boolean(getAuthToken())

  // Basic numbers & safe lookups
  const now = new Date()
  const currentMonthDays = daysInMonth(now.getFullYear(), now.getMonth())
  const monthlyUsage = totalDailyUsage * currentMonthDays
  const generalReference = typeof illustrativeReferenceEstimates.daily === 'number' ? illustrativeReferenceEstimates.daily : 0

  const frontendHouseholdSize = typeof settings.householdSize === 'number' ? settings.householdSize : 2
  const householdKey = frontendHouseholdSize >= 5 ? 5 : Math.max(1, frontendHouseholdSize)
  const staticHouseholdReference =
    illustrativeReferenceEstimates.by_household_size?.[householdKey as keyof typeof illustrativeReferenceEstimates.by_household_size] ??
    illustrativeReferenceEstimates.by_household_size?.[5] ??
    generalReference

  const generalReferenceDifference = calculateReferenceDifference(totalDailyUsage, generalReference, trackedAppliances.length > 0)
  const householdReferenceDifference = calculateReferenceDifference(totalDailyUsage, staticHouseholdReference, trackedAppliances.length > 0)

  // Appliance-level comparisons (fixed avg calculation)
  const applianceComparisons = useMemo(() => {
    return trackedAppliances
      .map(appliance => {
        const applianceType = appliance.type
        const userDailyUsage = getKwhPerDay(appliance)

        // Prefer the bundled static per-appliance reference; otherwise derive an illustrative type estimate.
        const dbAvgKwh =
          (illustrativeReferenceEstimates.by_appliance?.[applianceType as keyof typeof illustrativeReferenceEstimates.by_appliance] as number | undefined) ??
          undefined

        let avgDailyUsage: number
        if (typeof dbAvgKwh === 'number' && dbAvgKwh > 0) {
          avgDailyUsage = dbAvgKwh
        } else {
          const typeInfo = getApplianceTypeInfo(applianceType)
          const avgWatt = typeInfo?.averageWattage
          if (typeof avgWatt === 'number' && avgWatt > 0) {
            avgDailyUsage = (avgWatt * appliance.hoursPerDay * (appliance.daysPerWeek / 7)) / 1000
          } else {
            avgDailyUsage = 1 // safe fallback
          }
        }

        const referenceDifference = calculateReferenceDifference(userDailyUsage, avgDailyUsage, true) ?? 0

        return {
          name: appliance.name,
          userUsage: userDailyUsage,
          avgUsage: avgDailyUsage,
          referenceDifference,
        }
      })
      .sort((a, b) => a.referenceDifference - b.referenceDifference)
  }, [trackedAppliances, getApplianceTypeInfo])

  const getComparisonIndicator = (difference: number) => {
    if (difference < -10) return <ArrowDownRight className="h-5 w-5 text-green-500" />
    if (difference > 10) return <ArrowUpRight className="h-5 w-5 text-red-500" />
    return <Minus className="h-5 w-5 text-gray-500" />
  }

  const staticScenarioReferences = useMemo<Bucket[]>(() => [
    { name: 'Your Formula Estimate', value: totalDailyUsage },
    { name: 'Illustrative Low Scenario', value: staticHouseholdReference * 0.7 },
    { name: 'Illustrative Typical Scenario', value: staticHouseholdReference },
    { name: 'Illustrative High Scenario', value: staticHouseholdReference * 1.3 },
  ], [staticHouseholdReference, totalDailyUsage])

  // Full-stack mode can add a local-installation average from records in this H2 database.
  useEffect(() => {
    if (!token) {
      setReferenceData(null)
      setReferenceError(null)
      setReferenceSource('sample')
      setLoadingReference(false)
      return
    }

    const controller = new AbortController()
    const fetchReference = async () => {
      setLoadingReference(true)
      setReferenceError(null)
      try {
        const res = await api.get<ComparisonApiResponse>('comparisons', {
          params: { householdSize: frontendHouseholdSize },
          signal: controller.signal,
        })

        const body = res.data
        setReferenceSource(body.source === 'local-database' && body.isSample === false ? 'local-database' : 'sample')
        if (typeof body.householdAvg === 'number') {
          setReferenceData([
            { name: 'Your Formula Estimate', value: totalDailyUsage },
            { name: body.isSample === false ? 'Local H2 Stored-Record Average' : 'Illustrative Household Scenario', value: Number(body.householdAvg) },
            { name: 'Static General Reference', value: generalReference },
          ])
        } else {
          setReferenceData(staticScenarioReferences)
        }
      } catch (err: unknown) {
        if (controller.signal.aborted) return
        console.error('Failed to load local reference data', err)
        setReferenceError('Local H2 reference unavailable — showing bundled illustrative planning assumptions.')
        setReferenceSource('sample')
        setReferenceData(staticScenarioReferences)
      } finally {
        setLoadingReference(false)
      }
    }

    fetchReference()
    return () => controller.abort()
  }, [token, frontendHouseholdSize, totalDailyUsage, generalReference, staticScenarioReferences])

  const getDifferencePillClass = (difference: number | null) => {
    if (difference === null) return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
    return difference <= 0
      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
  }

  const activeReferenceDifference = compareWith === 'national' ? generalReferenceDifference : householdReferenceDifference
  const selectedScenario = HOUSEHOLD_SCENARIOS.find(scenario => scenario.key === scenarioProfile) ?? HOUSEHOLD_SCENARIOS[0]
  const generatedScenarioDailyKwh = useMemo(() => {
    const sizeFactor = 1 + Math.max(0, scenarioHouseholdSize - 1) * 0.12
    const weekendFactor = selectedScenario.key === 'remote-work' ? 1.03 : 1
    return selectedScenario.baseKwhPerPerson * scenarioHouseholdSize * selectedScenario.householdMultiplier * sizeFactor * weekendFactor
  }, [scenarioHouseholdSize, selectedScenario])
  const generatedScenarioMonthlyKwh = generatedScenarioDailyKwh * currentMonthDays
  const scenarioDifference = generatedScenarioDailyKwh - totalDailyUsage

  const effectiveReferenceData = referenceData ?? staticScenarioReferences

  useEffect(() => {
    setScenarioHouseholdSize(Math.max(1, frontendHouseholdSize))
  }, [frontendHouseholdSize])

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Illustrative Energy References</h1>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100">
        <strong>Whole-home comparison warning:</strong> this estimate includes only the active appliances you added. Add major loads—including HVAC, water heating, refrigeration, cooking, lighting, laundry, EV charging, and pool equipment—before treating it as a whole-home comparison.
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
        <strong>Source:</strong> EnergyIQ bundled illustrative planning assumptions—not measured local, national, or community data.
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setCompareWith('national')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'national' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          Static General Reference
        </button>
        <button
          onClick={() => setCompareWith('household')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'household' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          Static Household Reference
        </button>
        <button
          onClick={() => setCompareWith('similar')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'similar' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          Illustrative Scenarios
        </button>
      </div>

      {/* Overall Comparison */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">
          {compareWith === 'national'
            ? 'Static General Reference'
            : compareWith === 'household'
            ? `Static ${frontendHouseholdSize}-Person Household Reference`
            : 'Illustrative Scenario References'}
        </h2>

        {compareWith === 'similar' ? (
          <>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h3 className="font-medium">Reference provenance</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {referenceSource === 'local-database'
                      ? 'The local H2 value is an average of recorded entries stored in this installation. It is not a representative community or user statistic.'
                      : 'These are bundled illustrative scenarios—not observations, population statistics, or measurements.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap">
              {effectiveReferenceData.map((item, i) => (
                <div key={i} className={`w-full md:w-1/4 p-2 ${item.name === 'Your Formula Estimate' ? 'order-first md:order-none' : ''}`}>
                  <div className={`p-4 rounded-lg ${item.name === 'Your Formula Estimate' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <h3 className={`font-medium ${item.name === 'Your Formula Estimate' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{item.name}</h3>
                    <p className="text-2xl font-semibold mt-1">{formatNumber(item.value, 1)} kWh</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per day</p>
                  </div>
                </div>
              ))}
            </div>

            {loadingReference && <div className="mt-3 text-sm text-gray-500">Loading local H2 reference data…</div>}
            {referenceError && <div className="mt-3 text-sm text-yellow-600">{referenceError}</div>}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
              <div className="w-full sm:w-1/2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Your Estimated Daily Usage</h3>
                    <p className="text-2xl font-semibold">{formatNumber(totalDailyUsage, 2)} kWh</p>
                  </div>
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                    {monthlyUsage.toFixed(0)} kWh/mo
                  </span>
                </div>
              </div>

              <div className="w-full sm:w-1/2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">
                      {compareWith === 'national' ? 'Static General Reference Estimate' : 'Static Household Reference Estimate'}
                    </h3>
                    <p className="text-2xl font-semibold">{formatNumber(compareWith === 'national' ? generalReference : staticHouseholdReference, 1)} kWh</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${getDifferencePillClass(activeReferenceDifference)}`}>
                    {activeReferenceDifference === null
                      ? 'Reference unavailable'
                      : activeReferenceDifference === 0
                        ? 'Matches reference'
                        : `${Math.abs(activeReferenceDifference).toFixed(1)}% ${activeReferenceDifference < 0 ? 'below' : 'above'} reference`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-1">Estimated Daily kWh by Appliance</h3>
              <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">Appliance references are bundled illustrative planning assumptions, not measured peer data.</p>
              {trackedAppliances.length > 0 ? (
                <div className="space-y-3">
                  {applianceComparisons.slice(0, 6).map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-32 sm:w-40 font-medium truncate pr-2">{item.name}</div>
                      <div className="flex-1">
                        <div className="h-6 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.referenceDifference < -20 ? 'bg-green-500' : item.referenceDifference <= 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${item.referenceDifference > 100 ? 100 : item.referenceDifference < -100 ? 0 : 50 + item.referenceDifference / 2}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 sm:w-28 flex items-center justify-end">
                        <span className={`text-sm ${item.referenceDifference < -20 ? 'text-green-600 dark:text-green-400' : item.referenceDifference <= 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          {getComparisonIndicator(item.referenceDifference)}
                        </span>
                        <span className="ml-1 text-sm">{formatNumber(item.userUsage, 1)} vs {formatNumber(item.avgUsage, 1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Add appliances to see illustrative appliance reference estimates.</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-medium mb-4">Illustrative Scenario Explorer</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Explore illustrative sample profiles to see how assumptions about family size and lifestyle change estimated usage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex flex-col gap-1 text-sm">
            Household Size
            <select
              value={scenarioHouseholdSize}
              onChange={e => setScenarioHouseholdSize(Number(e.target.value))}
              className="border rounded-md px-3 py-2 bg-white dark:bg-gray-900"
            >
              {Array.from({ length: 8 }, (_, index) => index + 1).map(size => (
                <option key={size} value={size}>
                  {size} {size === 1 ? 'person' : 'people'}
                </option>
              ))}
            </select>
          </label>

          <label className="md:col-span-2 flex flex-col gap-1 text-sm">
            Household Type
            <select
              value={scenarioProfile}
              onChange={e => setScenarioProfile(e.target.value as HouseholdProfileKey)}
              className="border rounded-md px-3 py-2 bg-white dark:bg-gray-900"
            >
              {HOUSEHOLD_SCENARIOS.map(profile => (
                <option key={profile.key} value={profile.key}>
                  {profile.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-4 rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800">
          <p className="font-medium">{selectedScenario.label}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedScenario.description}</p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-md bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Illustrative Daily Estimate</p>
              <p className="text-xl font-semibold">{formatNumber(generatedScenarioDailyKwh, 2)} kWh/day</p>
            </div>
            <div className="rounded-md bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Illustrative Monthly Estimate</p>
              <p className="text-xl font-semibold">{formatNumber(generatedScenarioMonthlyKwh, 0)} kWh/mo</p>
            </div>
            <div className="rounded-md bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Difference vs Your Formula Estimate</p>
              <p className={`text-xl font-semibold ${scenarioDifference <= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {scenarioDifference > 0 ? '+' : ''}
                {formatNumber(scenarioDifference, 2)} kWh/day
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-medium mb-4">Future Energy Cost</h2>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Choose Formula Projection for appliance-schedule results, or History-Based Forecast when qualifying recorded history is available. The two sources are never blended.</p>
        </div>
        <EnergyUsageChart useEstimate={true} />
      </div>

      {/* Neutral difference from the bundled household reference */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Estimated Difference from Reference</h2>
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <div className="text-3xl font-bold">
                {householdReferenceDifference === null ? '—' : `${Math.abs(householdReferenceDifference).toFixed(1)}%`}
              </div>
            </div>
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-8 border-t-transparent border-r-transparent" style={{
              borderLeftColor: (householdReferenceDifference ?? 0) < -10 ? '#10b981' : (householdReferenceDifference ?? 0) <= 10 ? '#f59e0b' : '#ef4444',
              borderBottomColor: (householdReferenceDifference ?? 0) < -10 ? '#10b981' : (householdReferenceDifference ?? 0) <= 10 ? '#f59e0b' : '#ef4444',
              transform: `rotate(${Math.min(180, Math.max(0, ((householdReferenceDifference ?? 0) + 50) * 1.8))}deg)`,
              transition: 'transform 1s ease-out'
            }} />
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="font-medium">
            {householdReferenceDifference === null
              ? 'Add an active appliance to calculate a difference.'
              : householdReferenceDifference === 0
                ? 'Your Formula Estimate matches the static household reference.'
                : `Your Formula Estimate is ${Math.abs(householdReferenceDifference).toFixed(1)}% ${householdReferenceDifference < 0 ? 'below' : 'above'} the static household reference.`}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">This is not an efficiency rating, audit, ranking, or measured result.</p>
        </div>
      </div>
    </div>
  )
}
