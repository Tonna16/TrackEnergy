import React, { useEffect, useMemo, useState } from 'react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { useAppContext, Appliance } from '../context/AppContext'
import { generateEstimate, type ConfidenceTier } from '../utils/energyEstimator'
import { normalizeToMondayKey, toWeeklyProjectionKwhMap, toWeeklyProjectionMap } from '../utils/weeklyProjectionMapper'

type ProjectionDTO = {
  date: string // "yyyy-MM-dd" or "MMM yyyy"
  weekStart?: string
  weekEnd?: string
  totalKwh?: number
  totalCost: number
  byAppCost?: Record<string, number>
}

type UsageDTO = {
  date: string // "yyyy-MM-dd"
  kWhUsed: number
  applianceId?: number
  applianceName?: string
  byApplianceKwh?: Record<string, number>
}

function isoDate(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * WeeklyForecastCard
 * - only for logged-in users
 * - shows two weeks: the week containing the last usage (or anchor) and the next week
 * - attaches server projection if starts match; otherwise uses client fallback estimate when appliances exist
 */
export default function WeeklyForecastCard() {
  const { appliances, trackedAppliances, convertCurrency, formatConvertedCost, costFromKwh } = useAppContext()
  const token = getAuthToken()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projections, setProjections] = useState<ProjectionDTO[]>([])
  const [usageLogs, setUsageLogs] = useState<UsageDTO[]>([])

  // earliest appliance creation date (fallback anchor) — use appliance createdAt if present
  const earliestDateStr = useMemo(() => {
    if (!appliances || appliances.length === 0) return null
    const parsedDates = appliances
      .map((a: Appliance) => {
        const raw = (a as any).createdAt ?? (a as any).created_at ?? (a as any).createdAtUtc ?? null
        if (!raw) return null
        const d = new Date(raw)
        return isNaN(d.getTime()) ? null : d
      })
      .filter(Boolean) as Date[]

    if (parsedDates.length === 0) return null
    const earliest = parsedDates.reduce((min, d) => (d < min ? d : min), parsedDates[0])
    return isoDate(earliest)
  }, [appliances])

  // fallback start = 28 days ago
  const fallbackStart = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - 28)
    return isoDate(d)
  }, [])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError(null)

    const startDate = earliestDateStr ?? fallbackStart

    const projectionsReq = api.get<ProjectionDTO[]>('energy-usage/projections', {
      params: { timeRange: 'weekly' },
    })
    const usageReq = api.get<UsageDTO[]>('energy-usage', { params: { startDate } })

    Promise.all([projectionsReq, usageReq])
      .then(([projRes, usageRes]) => {
        setProjections(Array.isArray(projRes.data) ? projRes.data : [])
        setUsageLogs(Array.isArray(usageRes.data) ? usageRes.data : [])
        // quick debug
        console.debug('[WeeklyForecastCard] projections (raw):', projRes.data)
        console.debug('[WeeklyForecastCard] usage logs (raw):', usageRes.data)
      })
      .catch(err => {
        console.error('WeeklyForecastCard load error', err)
        setError('Failed to load weekly forecast / usage.')
      })
      .finally(() => setLoading(false))
  }, [token, earliestDateStr, fallbackStart])

  // aggregate usage logs to date -> kWh
  const usageByDate = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of usageLogs) {
      const key = row.date
      const prev = map.get(key) ?? 0
      map.set(key, prev + (row.kWhUsed ?? 0))
    }
    return map
  }, [usageLogs])

  // Build exactly two 7-day windows: last usage week and the next week (forecast)
  const weeklyRow = useMemo(() => {
    const anchorStr = earliestDateStr ?? fallbackStart
    const anchor = new Date(anchorStr + 'T00:00:00')
    anchor.setHours(0, 0, 0, 0)
  
    // Helper: start of week (Monday)
    function startOfWeekMonday(d: Date) {
      const day = d.getDay()
      const daysSinceMonday = (day + 6) % 7
      const start = new Date(d)
      start.setDate(d.getDate() - daysSinceMonday)
      start.setHours(0, 0, 0, 0)
      return start
    }
  
    // Calculate the number of weeks elapsed since the anchor week start
    const today = new Date()
    today.setHours(0, 0, 0, 0)
  
    const anchorWeekStart = startOfWeekMonday(anchor)
  
    // Find number of weeks passed since anchor week
    const diffDays = Math.floor((today.getTime() - anchorWeekStart.getTime()) / (1000 * 60 * 60 * 24))
    const weeksPassed = Math.max(0, Math.floor(diffDays / 7))
  
    // Determine the current forecast week start by adding weeksPassed to anchorWeekStart
    const currentWeekStart = new Date(anchorWeekStart)
    currentWeekStart.setDate(currentWeekStart.getDate() + weeksPassed * 7)
    const currentWeekEnd = new Date(currentWeekStart)
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6)
  
    // Aggregate usage kWh for this week
    let sum = 0
    for (let d = new Date(currentWeekStart); d <= currentWeekEnd; d.setDate(d.getDate() + 1)) {
      sum += usageByDate.get(isoDate(d)) ?? 0
    }
  
    const projMap = toWeeklyProjectionMap(projections, convertCurrency)
    const projKwhMap = toWeeklyProjectionKwhMap(projections)
  
    // Check for server projection for current week
    const currentWeekKey = normalizeToMondayKey(isoDate(currentWeekStart))
    const projVal = currentWeekKey ? projMap.get(currentWeekKey) : undefined
    const projectedKwh = currentWeekKey ? projKwhMap.get(currentWeekKey) : undefined
  
    let forecastCost: number | null = null
    let source: 'backend' | 'fallback' | 'none' = 'none'
    let confidence: ConfidenceTier = 'low'
    const visibleApps = trackedAppliances

    if (typeof projVal === 'number' && Number.isFinite(projVal)) {
      forecastCost = projVal
      source = 'backend'
      confidence = 'high'
    } else if (visibleApps.length > 0) {
      try {
        const estPoints = generateEstimate({
          appliances: visibleApps,
          convertCost: costFromKwh,
          count: 1,
          daysPer: 7,
          monthly: false,
          disableNoise: true,
          getApplianceTypeInfo: undefined,
          usageHistory: usageLogs,
          mode: 'live',
        })
        const estVal = estPoints?.[0]?.total ?? NaN
        if (Number.isFinite(estVal)) {
          forecastCost = estVal
          source = 'fallback'
          confidence = estPoints?.[0]?.confidence ?? 'low'
        }
      } catch {
        forecastCost = null
      }
    }
  
    return {
      start: isoDate(currentWeekStart),
      end: isoDate(currentWeekEnd),
      actualKwh: sum > 0 ? sum : null,
      forecastCost,
      source,
      confidence,
      projectedKwh: typeof projectedKwh === 'number' && Number.isFinite(projectedKwh) ? projectedKwh : null,
    }
  }, [earliestDateStr, fallbackStart, usageByDate, usageLogs, projections, convertCurrency, trackedAppliances, costFromKwh])
  
  const fmtCost = (val: number | null | undefined) =>
    typeof val === 'number' && Number.isFinite(val) ? formatConvertedCost(val) : '—'

  return (
<div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-lg font-medium">Weekly Usage & Forecast</h3>
    <div className="text-xs text-gray-500">Weeks anchored on first appliance date</div>
  </div>

  {loading ? (
    <div className="py-6 text-center text-sm text-gray-500">Loading weekly data…</div>
  ) : error ? (
    <div className="py-4 text-sm text-red-500">{error}</div>
  ) : !weeklyRow ? (
    <div className="py-6 text-center text-sm text-gray-500">No data available yet.</div>
  ) : (
    <div className="space-y-2 text-sm">
      <div className="flex justify-between items-center py-2 border-b last:border-b-0">
        <div>
          <div className="font-medium">
            {weeklyRow.start} → {weeklyRow.end}
          </div>
          <div className="text-xs text-gray-400">
            Actual: {weeklyRow.actualKwh !== null ? `${weeklyRow.actualKwh.toFixed(2)} kWh` : 'No data yet'}
          </div>
          <div className="text-xs text-gray-400">
            Forecast: {weeklyRow.projectedKwh !== null ? `${weeklyRow.projectedKwh.toFixed(2)} kWh` : 'No usage forecast'}
          </div>
        </div>
        <div className="text-right">
          <div className="font-semibold">
            {weeklyRow.forecastCost != null ? formatConvertedCost(weeklyRow.forecastCost) : <span className="text-gray-400">No forecast</span>}
          </div>
          <div className="text-xs text-gray-400">
            {weeklyRow.source === 'fallback' ? 'Estimated Weekly Cost (fallback)' : 'Forecasted Weekly Cost'}
          </div>
          {weeklyRow.forecastCost != null && (
            <div className="text-[11px] text-gray-400">Confidence: {weeklyRow.confidence}</div>
          )}
        </div>
      </div>
    </div>
  )}
</div>

  )
}
