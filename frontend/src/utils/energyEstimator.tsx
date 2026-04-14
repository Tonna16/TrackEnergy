import type { Appliance } from '../context/AppContext'
import { isVisibleAppliance } from './applianceVisibility'
// 1. Static monthly seasonal multipliers
const SEASONAL: Record<number, number> = {
  0: 1.05, 1: 1.02, 2: 0.98, 3: 0.95,
  4: 0.95,  5: 1.1,  6: 1.15, 7: 1.15,
  8: 1.05, 9: 1.0,  10: 0.98, 11: 1.05,
}

const NOISE_BOUND = 0.02
const DEFAULT_CO2_FACTOR = 0.92 // kg CO₂ per kWh
const DOW_DEFAULT_FACTOR = 1
const HISTORY_HALF_LIFE_DAYS = 14

export type ConfidenceTier = 'high' | 'medium' | 'low'

export type UsageHistoryPoint = {
  date: string
  kWhUsed: number
  applianceId?: number
  applianceName?: string
  byApplianceKwh?: Record<string, number>
}

type CalibrationSnapshot = {
  dayOfWeekFactor: number[]
  applianceBaselineMultiplier: Map<number, number>
  confidence: ConfidenceTier
  sampleDays: number
}

/** 
 * Centralized per‑day kWh calculation 
 */
export function getKwhPerDay(
  app: Appliance,
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
) {
  // Use type’s average wattage if available, else app wattage
  const avgW = getApplianceTypeInfo?.(app.type)?.averageWattage ?? app.wattage
  const wattage = app.isHighEfficiency ? avgW * 0.8 : avgW
  // Multiply by fraction of week appliance is used (daysPerWeek / 7)
  return (wattage * app.hoursPerDay * (app.daysPerWeek / 7)) / 1000
}

export function getKwhPerWeek(
  app: Appliance,
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
) {
  return getKwhPerDay(app, getApplianceTypeInfo) * 7
}

export function getKwhPerMonth(
  app: Appliance,
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number },
  daysInMonth = 30
) {
  return getKwhPerDay(app, getApplianceTypeInfo) * daysInMonth
}

/** 
 * FNV‑1a hash, used to seed PRNG 
 */
function xfnv1a(str: string) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 
 * Mulberry32 PRNG 
 */
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a += 0x6d2b79f5
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export type ChartPoint = {
  date: string
  total?: number
  confidence?: ConfidenceTier
  isEstimated?: boolean
} & {
  [applianceName: string]: number | string | undefined
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function recencyWeight(date: Date, today: Date) {
  const ageDays = Math.max(
    0,
    Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  )
  return Math.pow(0.5, ageDays / HISTORY_HALF_LIFE_DAYS)
}

function safeDate(isoDate: string) {
  const parsed = new Date(`${isoDate}T00:00:00`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function buildCalibrationSnapshot({
  appliances,
  usageHistory,
  getApplianceTypeInfo,
}: {
  appliances: Appliance[]
  usageHistory?: UsageHistoryPoint[]
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
}): CalibrationSnapshot {
  const activeApps = appliances.filter(app => isVisibleAppliance(app, false))
  if (!usageHistory?.length || !activeApps.length) {
    return {
      dayOfWeekFactor: Array.from({ length: 7 }, () => DOW_DEFAULT_FACTOR),
      applianceBaselineMultiplier: new Map(),
      confidence: 'low',
      sampleDays: 0,
    }
  }

  const appBaseline = new Map<number, number>()
  const modelDailyById = new Map<number, number>()
  let modelTotalDaily = 0

  for (const app of activeApps) {
    const modeled = getKwhPerDay(app, getApplianceTypeInfo)
    if (modeled <= 0 || !Number.isFinite(modeled)) continue
    modelDailyById.set(app.id, modeled)
    modelTotalDaily += modeled
  }

  if (modelTotalDaily <= 0) {
    return {
      dayOfWeekFactor: Array.from({ length: 7 }, () => DOW_DEFAULT_FACTOR),
      applianceBaselineMultiplier: new Map(),
      confidence: 'low',
      sampleDays: 0,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dowWeightedSum = Array.from({ length: 7 }, () => 0)
  const dowWeight = Array.from({ length: 7 }, () => 0)

  let totalWeightedUsage = 0
  let totalWeight = 0
  let byAppSignals = 0

  for (const point of usageHistory) {
    if (typeof point.kWhUsed !== 'number' || point.kWhUsed < 0) continue
    const parsed = safeDate(point.date)
    if (!parsed) continue
    const weight = recencyWeight(parsed, today)
    const dow = parsed.getDay()
    dowWeightedSum[dow] += point.kWhUsed * weight
    dowWeight[dow] += weight
    totalWeightedUsage += point.kWhUsed * weight
    totalWeight += weight

    const byName = point.byApplianceKwh
    if (byName && Object.keys(byName).length > 0) {
      byAppSignals += 1
      for (const app of activeApps) {
        const keyUsage = byName[app.name] ?? 0
        appBaseline.set(app.id, (appBaseline.get(app.id) ?? 0) + keyUsage * weight)
      }
      continue
    }

    // Fallback split when history is aggregate-only: distribute via modeled shares.
    for (const app of activeApps) {
      const modeled = modelDailyById.get(app.id) ?? 0
      if (modeled <= 0) continue
      const share = modeled / modelTotalDaily
      appBaseline.set(app.id, (appBaseline.get(app.id) ?? 0) + point.kWhUsed * share * weight)
    }
  }

  const overallDaily = totalWeight > 0 ? totalWeightedUsage / totalWeight : 0
  const dayOfWeekFactor = dowWeightedSum.map((sum, dow) => {
    if (!dowWeight[dow] || overallDaily <= 0) return DOW_DEFAULT_FACTOR
    const dowMean = sum / dowWeight[dow]
    return clamp(dowMean / overallDaily, 0.75, 1.25)
  })

  const applianceBaselineMultiplier = new Map<number, number>()
  for (const app of activeApps) {
    const observedDaily = (appBaseline.get(app.id) ?? 0) / Math.max(totalWeight, 1)
    const modeled = modelDailyById.get(app.id) ?? 0
    if (modeled <= 0 || observedDaily <= 0) {
      applianceBaselineMultiplier.set(app.id, DOW_DEFAULT_FACTOR)
      continue
    }
    const ratio = observedDaily / modeled
    applianceBaselineMultiplier.set(app.id, clamp(ratio, 0.6, 1.5))
  }

  return {
    dayOfWeekFactor,
    applianceBaselineMultiplier,
    confidence: getProjectionConfidence({
      sampleDays: Math.round(totalWeight),
      applianceCount: activeApps.length,
      hasPerApplianceSignals: byAppSignals > 0,
    }),
    sampleDays: Math.round(totalWeight),
  }
}

export function getProjectionConfidence({
  sampleDays,
  applianceCount,
  hasPerApplianceSignals = false,
}: {
  sampleDays: number
  applianceCount: number
  hasPerApplianceSignals?: boolean
}): ConfidenceTier {
  if (sampleDays >= 28 && applianceCount >= 3 && hasPerApplianceSignals) return 'high'
  if (sampleDays >= 14 && applianceCount >= 1) return 'medium'
  return 'low'
}

/**
 * Generates a projected cost series.
 */
export function generateEstimate({
  appliances,
  convertCost,
  count,
  daysPer,
  monthly = false,
  disableNoise = false,
  getApplianceTypeInfo,
  mode,
  seasonalAdjust = true,
  includeInactive = false,
  usageHistory,
}: {
  appliances: Appliance[]
  convertCost: (kwh: number) => number
  count: number
  daysPer: number
  monthly?: boolean
  disableNoise?: boolean
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
  mode?: 'simulated' | 'live'
  seasonalAdjust?: boolean
  includeInactive?: boolean
  usageHistory?: UsageHistoryPoint[]
}): ChartPoint[] {
  const calibration = buildCalibrationSnapshot({
    appliances,
    usageHistory,
    getApplianceTypeInfo,
  })

  const today = new Date()
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today)
    if (monthly) d.setMonth(d.getMonth() + i + 1)
    else d.setDate(d.getDate() + (i + 1) * daysPer)

    const label = monthly
      ? d.toLocaleString('default', { month: 'short' })
      : d.toISOString().split('T')[0]

    let total = 0
    const byApp: Record<string, number> = {}

    appliances.forEach(app => {
      if (
        (!app.wattage && !getApplianceTypeInfo?.(app.type)?.averageWattage) || 
        !app.hoursPerDay || 
        !app.daysPerWeek
      ) return
    
      if (!isVisibleAppliance(app, includeInactive)) return

      const baseDaily = getKwhPerDay(app, getApplianceTypeInfo)
      const intervalKwh = baseDaily * (monthly ? d.getDate() : daysPer)
      const baselineFactor = calibration.applianceBaselineMultiplier.get(app.id) ?? 1
      const dowFactor = calibration.dayOfWeekFactor[d.getDay()] ?? 1

      const season = seasonalAdjust ? (SEASONAL[d.getMonth()] ?? 1) : 1
      const noise = disableNoise
        ? 1
        : mode === 'simulated'
        ? 1 + (mulberry32(xfnv1a(`${app.id}-${label}`))() * 2 * NOISE_BOUND - NOISE_BOUND)
        : 1

      const kwh = intervalKwh * season * noise * baselineFactor * dowFactor
      const cost = convertCost(kwh)
      byApp[app.name] = cost
      total += cost
    })

    return { date: label, total, ...byApp, confidence: calibration.confidence, isEstimated: true }
  })
}

/**
 * Estimates annual cost & carbon from appliances alone.
 */
export function estimateAnnualFromAppliances({
  appliances,
  electricityRate,
  getApplianceTypeInfo,
  disableNoise = false,
  convertCost = (usd: number) => usd,
}: {
  appliances: Appliance[]
  electricityRate: number
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
  disableNoise?: boolean
  convertCost?: (usd: number) => number
}) {
  let totalKwhPerDay = 0

  for (const app of appliances) {
    if (!isVisibleAppliance(app, false)) continue
    totalKwhPerDay += getKwhPerDay(app, getApplianceTypeInfo)
  }
  

  const month = new Date().getMonth()
  const noise = disableNoise
    ? 1
    : 1 + (mulberry32(xfnv1a(`annual-estimate-${month}`))() * 2 * NOISE_BOUND - NOISE_BOUND)

  const seasonal = SEASONAL[month] ?? 1
  const annualKwh = totalKwhPerDay * 365 * seasonal * noise
  const annualCostUsd = annualKwh * electricityRate
  const annualCost = convertCost(annualCostUsd)
  const annualCarbon = annualKwh * DEFAULT_CO2_FACTOR

  return { annualCost, annualCarbon }
}
