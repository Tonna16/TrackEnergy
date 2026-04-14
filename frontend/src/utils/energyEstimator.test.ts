import { describe, expect, it } from 'vitest'
import type { Appliance } from '../context/AppContext'
import { generateEstimate, getKwhPerDay, getKwhPerMonth, getKwhPerWeek } from './energyEstimator'

function makeAppliance(overrides: Partial<Appliance> = {}): Appliance {
  return {
    id: 1,
    name: 'Test Appliance',
    type: 'other',
    wattage: 1000,
    hoursPerDay: 2,
    daysPerWeek: 7,
    isHighEfficiency: false,
    location: 'Other',
    active: true,
    ...overrides,
  }
}

describe('energyEstimator canonical kWh helpers', () => {
  it('calculates daily kWh using daysPerWeek weighting', () => {
    const appliance = makeAppliance({ wattage: 1000, hoursPerDay: 2, daysPerWeek: 3.5 })
    expect(getKwhPerDay(appliance)).toBeCloseTo(1, 6)
  })

  it('handles daysPerWeek edge cases of 0 and 7', () => {
    expect(getKwhPerDay(makeAppliance({ daysPerWeek: 0 }))).toBeCloseTo(0, 6)
    expect(getKwhPerDay(makeAppliance({ daysPerWeek: 7 }))).toBeCloseTo(2, 6)
  })

  it('converts daily usage to weekly usage', () => {
    const appliance = makeAppliance({ wattage: 1500, hoursPerDay: 2, daysPerWeek: 7 })
    expect(getKwhPerDay(appliance)).toBeCloseTo(3, 6)
    expect(getKwhPerWeek(appliance)).toBeCloseTo(21, 6)
  })

  it('converts daily usage to monthly usage with default and custom days', () => {
    const appliance = makeAppliance({ wattage: 500, hoursPerDay: 4, daysPerWeek: 7 })
    expect(getKwhPerDay(appliance)).toBeCloseTo(2, 6)
    expect(getKwhPerMonth(appliance)).toBeCloseTo(60, 6)
    expect(getKwhPerMonth(appliance, undefined, 31)).toBeCloseTo(62, 6)
  })

  it('produces stable deterministic projections when using history calibration', () => {
    const appliances = [makeAppliance()]
    const usageHistory = [
      { date: '2026-04-10', kWhUsed: 3.2 },
      { date: '2026-04-11', kWhUsed: 3.4 },
      { date: '2026-04-12', kWhUsed: 3.1 },
      { date: '2026-04-13', kWhUsed: 3.3 },
    ]

    const args = {
      appliances,
      convertCost: (kwh: number) => kwh * 0.2,
      count: 3,
      daysPer: 1,
      disableNoise: true,
      mode: 'live' as const,
      usageHistory,
    }

    const firstRun = generateEstimate(args)
    const secondRun = generateEstimate(args)

    expect(firstRun).toEqual(secondRun)
    expect(firstRun.every(point => point.confidence)).toBe(true)
  })

  it('increases projected totals when appliance activity increases', () => {
    const base = makeAppliance({ hoursPerDay: 1, daysPerWeek: 7 })
    const boosted = makeAppliance({ hoursPerDay: 3, daysPerWeek: 7 })
    const usageHistory = [
      { date: '2026-04-10', kWhUsed: 2.5 },
      { date: '2026-04-11', kWhUsed: 2.7 },
      { date: '2026-04-12', kWhUsed: 2.6 },
    ]

    const baseForecast = generateEstimate({
      appliances: [base],
      convertCost: (kwh: number) => kwh * 0.2,
      count: 1,
      daysPer: 7,
      disableNoise: true,
      mode: 'live',
      usageHistory,
    })
    const boostedForecast = generateEstimate({
      appliances: [boosted],
      convertCost: (kwh: number) => kwh * 0.2,
      count: 1,
      daysPer: 7,
      disableNoise: true,
      mode: 'live',
      usageHistory,
    })

    expect((boostedForecast[0].total ?? 0)).toBeGreaterThan(baseForecast[0].total ?? 0)
  })
})
