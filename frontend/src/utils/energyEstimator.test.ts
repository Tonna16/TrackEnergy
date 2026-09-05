import { afterEach, describe, expect, it, vi } from 'vitest';
import domain from '../../../shared/energy-domain.json';
import type { Appliance } from '../context/AppContext';
import { generateEstimate } from './energyEstimator';
import {
  CARBON_KG_PER_KWH,
  calculateCarbonKg,
  calculateCost,
  daysInMonth,
  daysInYear,
  formatCurrency,
  getKwhForMonth,
  getKwhPerDay,
  getKwhPerWeek,
  getKwhPerYear,
  totalDailyKwh,
} from './energyCalculations';

const appliance = (overrides: Partial<Appliance> = {}): Appliance => ({
  id: 1,
  name: 'Test Appliance',
  type: 'other',
  wattage: 1000,
  hoursPerDay: 2,
  daysPerWeek: 7,
  isHighEfficiency: false,
  location: 'Other',
  active: true,
  deleted: false,
  ...overrides,
});

afterEach(() => vi.useRealTimers());

describe('canonical Formula Estimate calculations', () => {
  it('matches every cross-stack example from the shared fixture', () => {
    domain.calculationExamples.forEach(example => {
      expect(getKwhPerDay(appliance({
        wattage: example.wattage,
        hoursPerDay: example.hoursPerDay,
        daysPerWeek: example.daysPerWeek,
        estimatedDailyKWh: example.estimatedDailyKWh,
      }))).toBeCloseTo(example.expectedDailyKwh, 12);
    });
  });

  it('calculates daily and weekly usage for fewer than seven days per week', () => {
    const input = appliance({ wattage: 1200, hoursPerDay: 1, daysPerWeek: 5 });
    expect(getKwhPerDay(input)).toBeCloseTo(1.2 * 5 / 7, 12);
    expect(getKwhPerWeek(input)).toBeCloseTo(6, 12);
  });

  it('supports zero schedules and manual overrides including zero', () => {
    expect(getKwhPerDay(appliance({ hoursPerDay: 0 }))).toBe(0);
    expect(getKwhPerDay(appliance({ daysPerWeek: 0 }))).toBe(0);
    expect(getKwhPerDay(appliance({ estimatedDailyKWh: 1.25 }))).toBe(1.25);
    expect(getKwhPerDay(appliance({ estimatedDailyKWh: 0 }))).toBe(0);
  });

  it('uses exact 28, 29, 30, and 31-day calendar months', () => {
    const oneKwh = appliance({ wattage: 1000, hoursPerDay: 1 });
    expect(daysInMonth(2025, 1)).toBe(28);
    expect(daysInMonth(2024, 1)).toBe(29);
    expect(daysInMonth(2026, 3)).toBe(30);
    expect(daysInMonth(2026, 0)).toBe(31);
    expect(getKwhForMonth(oneKwh, 2025, 1)).toBe(28);
    expect(getKwhForMonth(oneKwh, 2024, 1)).toBe(29);
    expect(getKwhForMonth(oneKwh, 2026, 3)).toBe(30);
    expect(getKwhForMonth(oneKwh, 2026, 0)).toBe(31);
  });

  it('uses 365 or 366 days for annual usage', () => {
    const oneKwh = appliance({ wattage: 1000, hoursPerDay: 1 });
    expect(daysInYear(2025)).toBe(365);
    expect(daysInYear(2024)).toBe(366);
    expect(getKwhPerYear(oneKwh, 2025)).toBe(365);
    expect(getKwhPerYear(oneKwh, 2024)).toBe(366);
  });

  it('excludes inactive and deleted appliances from household totals', () => {
    expect(totalDailyKwh([
      appliance({ id: 1 }),
      appliance({ id: 2, active: false }),
      appliance({ id: 3, deleted: true }),
    ])).toBe(2);
  });

  it('does not let high-efficiency metadata alter authoritative wattage', () => {
    const standard = getKwhPerDay(appliance({ wattage: 700, isHighEfficiency: false }));
    const highEfficiency = getKwhPerDay(appliance({ wattage: 700, isHighEfficiency: true }));
    expect(highEfficiency).toBe(standard);
  });

  it('calculates cost once while currency changes formatting only', () => {
    expect(calculateCost(10, 0.2)).toBe(2);
    expect(formatCurrency(2, 'USD')).toMatch(/\$|USD/);
    expect(formatCurrency(2, 'EUR')).toMatch(/€|EUR/);
    expect(calculateCost(10, 0.2)).toBe(2);
  });

  it('uses the shared 0.394 carbon factor', () => {
    expect(CARBON_KG_PER_KWH).toBe(0.394);
    expect(calculateCarbonKg(10)).toBeCloseTo(3.94, 12);
  });

  it('builds monthly projections from the target month length', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2024, 0, 15, 12));
    const points = generateEstimate({
      appliances: [appliance({ wattage: 1000, hoursPerDay: 1 })],
      costFromKwh: value => value,
      count: 2,
      daysPer: 1,
      monthly: true,
    });
    expect(points.map(point => point.daysInPeriod)).toEqual([29, 31]);
    expect(points.map(point => point.total)).toEqual([29, 31]);
  });
});
