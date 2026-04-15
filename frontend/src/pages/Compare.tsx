// src/pages/Compare.tsx
import { useEffect, useMemo, useState } from 'react'
import { useAppContext } from '../context/AppContext'
import EnergyUsageChart from '../components/EnergyUsageChart'
import { nationalAverages } from '../data/applianceDatabase'
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { getKwhPerDay } from '../utils/energyEstimator'

function formatNumber(n: number, digits = 1) {
  return Number.isFinite(n) ? n.toFixed(digits) : '0.0'
}

type Bucket = { name: string; value: number }
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
    label: 'Efficiency Focused',
    description: 'Conservation habits and efficient appliances.',
    baseKwhPerPerson: 2.9,
    householdMultiplier: 0.86,
  },
]

export default function Compare() {
  const { totalDailyUsage, appliances, settings, getApplianceTypeInfo } = useAppContext()
  const [compareWith, setCompareWith] = useState<'national' | 'household' | 'similar'>('national')

  // Community fetch state
  const [loadingCommunity, setLoadingCommunity] = useState(false)
  const [communityError, setCommunityError] = useState<string | null>(null)
  const [communityData, setCommunityData] = useState<Bucket[] | null>(null)
  const [communityHouseholdAvg, setCommunityHouseholdAvg] = useState<number | null>(null)
  const [scenarioHouseholdSize, setScenarioHouseholdSize] = useState<number>(2)
  const [scenarioProfile, setScenarioProfile] = useState<HouseholdProfileKey>('balanced')

  const token = Boolean(getAuthToken())

  // Basic numbers & safe lookups
  const monthlyUsage = totalDailyUsage * 30
  const nationalAvg = typeof nationalAverages.daily === 'number' ? nationalAverages.daily : 0

  const frontendHouseholdSize = typeof settings.householdSize === 'number' ? settings.householdSize : 2
  const householdKey = frontendHouseholdSize >= 5 ? 5 : Math.max(1, frontendHouseholdSize)
  const householdAvgFromDb =
    nationalAverages.by_household_size?.[householdKey as keyof typeof nationalAverages.by_household_size] ??
    nationalAverages.by_household_size?.[5] ??
    nationalAvg

  // If backend returned a household avg (aggregated), prefer it for the household comparison,
  // otherwise fall back to static nationalAverages.by_household_size or nationalAvg
  const householdAvg = communityHouseholdAvg ?? householdAvgFromDb

  // Efficiency score: positive = better (lower usage), negative = worse (higher usage)
  const calculateEfficiencyScore = (usageValue: number, baselineValue: number) => {
    if (!Number.isFinite(usageValue) || !Number.isFinite(baselineValue) || baselineValue <= 0) return null
    const rawScore = ((baselineValue - usageValue) / baselineValue) * 100
    return Math.max(-999, Math.min(999, rawScore))
  }

  const nationalEfficiencyScore = calculateEfficiencyScore(totalDailyUsage, nationalAvg)
  const householdEfficiencyScore = calculateEfficiencyScore(totalDailyUsage, householdAvg)

  // Appliance-level comparisons (fixed avg calculation)
  const applianceComparisons = useMemo(() => {
    return appliances
      .map(appliance => {
        const applianceType = appliance.type
        const userDailyUsage = getKwhPerDay(appliance)

        // Prefer national per-appliance daily average if available; else fallback to type average wattage -> daily kWh
        const dbAvgKwh =
          (nationalAverages.by_appliance?.[applianceType as keyof typeof nationalAverages.by_appliance] as number | undefined) ??
          undefined

        let avgDailyUsage: number
        if (typeof dbAvgKwh === 'number' && dbAvgKwh > 0) {
          avgDailyUsage = dbAvgKwh
        } else {
          const typeInfo = getApplianceTypeInfo(applianceType)
          const avgWatt = typeInfo?.averageWattage
          if (typeof avgWatt === 'number' && avgWatt > 0) {
            avgDailyUsage = getKwhPerDay(
              { ...appliance, isHighEfficiency: false },
              () => ({ averageWattage: avgWatt })
            )
          } else {
            avgDailyUsage = 1 // safe fallback
          }
        }

        const efficiencyScore = calculateEfficiencyScore(userDailyUsage, avgDailyUsage) ?? 0

        return {
          name: appliance.name,
          userUsage: userDailyUsage,
          avgUsage: avgDailyUsage,
          efficiencyScore,
        }
      })
      .sort((a, b) => b.efficiencyScore - a.efficiencyScore)
  }, [appliances, getApplianceTypeInfo])

  const getComparisonIndicator = (score: number) => {
    if (score > 10) return <ArrowDownRight className="h-5 w-5 text-green-500" />
    if (score < -10) return <ArrowUpRight className="h-5 w-5 text-red-500" />
    return <Minus className="h-5 w-5 text-gray-500" />
  }

  // Local fallback community data (used when server data missing)
  const localFallbackCommunity: Bucket[] = [
    { name: 'Your Usage', value: totalDailyUsage },
    { name: 'Energy Savers', value: householdAvg * 0.7 },
    { name: 'Average Users', value: householdAvg },
    { name: 'High Users', value: householdAvg * 1.3 },
  ]

  // Fetch community comparison from backend (if logged in)
  useEffect(() => {
    if (!token) {
      setCommunityData(null)
      setCommunityError(null)
      setCommunityHouseholdAvg(null)
      setLoadingCommunity(false)
      return
    }

    const controller = new AbortController()
    const fetchCommunity = async () => {
      setLoadingCommunity(true)
      setCommunityError(null)
      setCommunityHouseholdAvg(null)
      try {
        const res = await api.get('comparisons', {
          params: { householdSize: frontendHouseholdSize },
          signal: controller.signal as any,
        })

        const body = res?.data ?? {}

        // support several possible server shapes:
        // 1) [{name,value}, ...] (array) -> use directly
        // 2) { communityBuckets: [...] } -> use that
        // 3) { buckets: [...] } -> use that
        // 4) { householdAvg: number, nationalAvg?: number, communityBuckets?: [...] } -> use householdAvg and communityBuckets if present
        if (Array.isArray(body)) {
          setCommunityData(body as Bucket[])
        } else if (Array.isArray(body.communityBuckets)) {
          setCommunityData(body.communityBuckets)
          if (typeof body.householdAvg === 'number') setCommunityHouseholdAvg(Number(body.householdAvg))
        } else if (Array.isArray(body.buckets)) {
          setCommunityData(body.buckets)
          if (typeof body.householdAvg === 'number') setCommunityHouseholdAvg(Number(body.householdAvg))
        } else if (typeof body.householdAvg === 'number' && Array.isArray(body.communityBuckets)) {
          setCommunityHouseholdAvg(Number(body.householdAvg))
          setCommunityData(body.communityBuckets)
        } else if (typeof body.householdAvg === 'number') {
          // server returned a single aggregated value -> synthesize simple buckets
          setCommunityHouseholdAvg(Number(body.householdAvg))
          setCommunityData([
            { name: 'Your Usage', value: totalDailyUsage },
            { name: 'Area Average', value: Number(body.householdAvg) },
            { name: 'National Avg', value: Number(body.nationalAvg ?? nationalAvg) },
          ])
        } else {
          // unexpected shape -> fallback
          setCommunityData(localFallbackCommunity)
        }
      } catch (err: any) {
        if ((controller.signal as any).aborted) return
        console.error('Failed to load community comparison', err)
        setCommunityError('Unable to load community data — showing defaults.')
        setCommunityData(localFallbackCommunity)
      } finally {
        setLoadingCommunity(false)
      }
    }

    fetchCommunity()
    return () => controller.abort()
    // deliberately include totalDailyUsage & nationalAvg because localFallbackCommunity depends on them
  }, [token, settings.householdSize, totalDailyUsage, nationalAvg])

  const getEfficiencyPillClass = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
    return score >= 0
      ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
      : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
  }

  const activeEfficiencyScore = compareWith === 'national' ? nationalEfficiencyScore : householdEfficiencyScore
  const selectedScenario = HOUSEHOLD_SCENARIOS.find(scenario => scenario.key === scenarioProfile) ?? HOUSEHOLD_SCENARIOS[0]
  const generatedScenarioDailyKwh = useMemo(() => {
    const sizeFactor = 1 + Math.max(0, scenarioHouseholdSize - 1) * 0.12
    const weekendFactor = selectedScenario.key === 'remote-work' ? 1.03 : 1
    return selectedScenario.baseKwhPerPerson * scenarioHouseholdSize * selectedScenario.householdMultiplier * sizeFactor * weekendFactor
  }, [scenarioHouseholdSize, selectedScenario])
  const generatedScenarioMonthlyKwh = generatedScenarioDailyKwh * 30
  const scenarioDifference = generatedScenarioDailyKwh - totalDailyUsage

  // when rendering community panel, prefer server-provided data if available
  const effectiveCommunityData = communityData ?? localFallbackCommunity

  useEffect(() => {
    setScenarioHouseholdSize(Math.max(1, frontendHouseholdSize))
  }, [frontendHouseholdSize])

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usage Comparison</h1>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setCompareWith('national')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'national' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          National Average
        </button>
        <button
          onClick={() => setCompareWith('household')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'household' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          Similar Households
        </button>
        <button
          onClick={() => setCompareWith('similar')}
          className={`py-2 px-4 text-sm font-medium ${compareWith === 'similar' ? 'border-b-2 border-emerald-500 text-emerald-600' : 'text-gray-500'}`}
        >
          Community Groups
        </button>
      </div>

      {/* Overall Comparison */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">
          {compareWith === 'national'
            ? 'National Average Comparison'
            : compareWith === 'household'
            ? `Comparison with ${frontendHouseholdSize}-Person Households`
            : 'Community Comparison'}
        </h2>

        {compareWith === 'similar' ? (
          <>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h3 className="font-medium">Your Community Standing</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Based on similar households in your area</p>
                </div>
                <div className="mt-2 sm:mt-0 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 text-sm font-medium">
                  Top 40% of users
                </div>
              </div>
            </div>

            <div className="flex flex-wrap">
              {effectiveCommunityData.map((item, i) => (
                <div key={i} className={`w-full md:w-1/4 p-2 ${item.name === 'Your Usage' ? 'order-first md:order-none' : ''}`}>
                  <div className={`p-4 rounded-lg ${item.name === 'Your Usage' ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-gray-50 dark:bg-gray-800'}`}>
                    <h3 className={`font-medium ${item.name === 'Your Usage' ? 'text-emerald-600 dark:text-emerald-400' : ''}`}>{item.name}</h3>
                    <p className="text-2xl font-semibold mt-1">{formatNumber(item.value, 1)} kWh</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per day</p>
                  </div>
                </div>
              ))}
            </div>

            {loadingCommunity && <div className="mt-3 text-sm text-gray-500">Loading community data…</div>}
            {communityError && <div className="mt-3 text-sm text-yellow-600">{communityError}</div>}
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
              <div className="w-full sm:w-1/2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Your Daily Usage</h3>
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
                      {compareWith === 'national' ? 'National Average' : 'Similar Household Average'}
                    </h3>
                    <p className="text-2xl font-semibold">{formatNumber(compareWith === 'national' ? nationalAvg : householdAvg, 1)} kWh</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${getEfficiencyPillClass(activeEfficiencyScore)}`}>
                    {activeEfficiencyScore === null
                      ? 'Baseline unavailable'
                      : `${activeEfficiencyScore > 0 ? '+' : ''}${activeEfficiencyScore.toFixed(1)}% ${activeEfficiencyScore >= 0 ? 'Better' : 'Worse'}`}
                  </span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-medium mb-3">Daily Kwh Breakdown by Appliance</h3>
              {appliances.length > 0 ? (
                <div className="space-y-3">
                  {applianceComparisons.slice(0, 6).map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-32 sm:w-40 font-medium truncate pr-2">{item.name}</div>
                      <div className="flex-1">
                        <div className="h-6 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${item.efficiencyScore > 20 ? 'bg-green-500' : item.efficiencyScore > 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${item.efficiencyScore > 100 ? 100 : item.efficiencyScore < -100 ? 0 : 50 + item.efficiencyScore / 2}%` }}
                          />
                        </div>
                      </div>
                      <div className="w-24 sm:w-28 flex items-center justify-end">
                        <span className={`text-sm ${item.efficiencyScore > 20 ? 'text-green-600 dark:text-green-400' : item.efficiencyScore > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                          {getComparisonIndicator(item.efficiencyScore)}
                        </span>
                        <span className="ml-1 text-sm">{formatNumber(item.userUsage, 1)} vs {formatNumber(item.avgUsage, 1)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">Add appliances to see comparison by appliance type</p>
              )}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <h2 className="text-lg font-medium mb-4">Household Scenario Explorer</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Generate a realistic household profile to preview how different family sizes and lifestyles change projected usage.
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
              <p className="text-xs text-gray-500 dark:text-gray-400">Scenario Daily Usage</p>
              <p className="text-xl font-semibold">{formatNumber(generatedScenarioDailyKwh, 2)} kWh/day</p>
            </div>
            <div className="rounded-md bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Scenario Monthly Usage</p>
              <p className="text-xl font-semibold">{formatNumber(generatedScenarioMonthlyKwh, 0)} kWh/mo</p>
            </div>
            <div className="rounded-md bg-white dark:bg-gray-900 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Difference vs You</p>
              <p className={`text-xl font-semibold ${scenarioDifference <= 0 ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {scenarioDifference > 0 ? '+' : ''}
                {formatNumber(scenarioDifference, 2)} kWh/day
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Historical Comparison */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Historical Usage Comparison</h2>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">This chart shows your historical usage compared to average usage in your area.</p>
        </div>
        <EnergyUsageChart useEstimate={true} />
      </div>

      {/* Efficiency Score */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Your Energy Efficiency Score</h2>
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <div className="text-3xl font-bold">{(householdEfficiencyScore ?? 0) > 20 ? 'A+' : (householdEfficiencyScore ?? 0) > 10 ? 'A' : (householdEfficiencyScore ?? 0) > 0 ? 'B' : (householdEfficiencyScore ?? 0) > -10 ? 'C' : (householdEfficiencyScore ?? 0) > -20 ? 'D' : 'E'}</div>
            </div>
            <div className="absolute top-0 left-0 w-40 h-40 rounded-full border-8 border-t-transparent border-r-transparent" style={{
              borderLeftColor: (householdEfficiencyScore ?? 0) > 10 ? '#10b981' : (householdEfficiencyScore ?? 0) > -10 ? '#f59e0b' : '#ef4444',
              borderBottomColor: (householdEfficiencyScore ?? 0) > 10 ? '#10b981' : (householdEfficiencyScore ?? 0) > -10 ? '#f59e0b' : '#ef4444',
              transform: `rotate(${Math.min(180, Math.max(0, ((householdEfficiencyScore ?? 0) + 50) * 1.8))}deg)`,
              transition: 'transform 1s ease-out'
            }} />
          </div>
        </div>

        <div className="mt-4 text-center">
          <p className="font-medium">
            {(householdEfficiencyScore ?? 0) > 20 ? 'Excellent! Your energy usage is very efficient.' :
             (householdEfficiencyScore ?? 0) > 10 ? 'Great job! Your energy usage is better than most.' :
             (householdEfficiencyScore ?? 0) > 0 ? 'Good! Your energy usage is slightly better than average.' :
             (householdEfficiencyScore ?? 0) > -10 ? 'Average energy usage compared to similar households.' :
             (householdEfficiencyScore ?? 0) > -20 ? 'Your energy usage is somewhat higher than average.' :
             'Your energy usage is significantly higher than average.'}
          </p>
        </div>
      </div>
    </div>
  )
}
