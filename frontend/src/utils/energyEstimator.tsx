import type { Appliance } from '../context/AppContext'

// 1. Static monthly seasonal multipliers
const SEASONAL: Record<number, number> = {
  0: 1.05, 1: 1.02, 2: 0.98, 3: 0.95,
  4: 1.0,  5: 1.1,  6: 1.15, 7: 1.15,
  8: 1.05, 9: 1.0,  10: 0.98, 11: 1.05,
}

const NOISE_BOUND = 0.05
const DEFAULT_CO2_FACTOR = 0.92 // kg CO₂ per kWh

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
} & {
  [applianceName: string]: number | string | undefined
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
}: {
  appliances: Appliance[]
  convertCost: (kwh: number) => number
  count: number
  daysPer: number
  monthly?: boolean
  disableNoise?: boolean
  getApplianceTypeInfo?: (type: string) => { averageWattage?: number }
}): ChartPoint[] {
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
      if ((!app.wattage && !getApplianceTypeInfo?.(app.type)?.averageWattage) || !app.hoursPerDay || !app.daysPerWeek) return

      const baseDaily = getKwhPerDay(app, getApplianceTypeInfo)
      const intervalKwh = baseDaily * (monthly ? d.getDate() : daysPer)

      const season = SEASONAL[d.getMonth()] ?? 1
      const noise = disableNoise
        ? 1
        : 1 + (mulberry32(xfnv1a(`${app.id}-${label}`))() * 2 * NOISE_BOUND - NOISE_BOUND)

      const kwh = intervalKwh * season * noise
      const cost = convertCost(kwh)
      byApp[app.name] = cost
      total += cost
    })

    return { date: label, total, ...byApp }
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
