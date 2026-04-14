import { describe, expect, it } from 'vitest'
import type { Appliance } from '../context/AppContext'
import { getKwhPerDay, getKwhPerMonth, getKwhPerWeek } from './energyEstimator'

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
})
