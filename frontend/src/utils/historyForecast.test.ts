import domain from '../../../shared/energy-domain.json';
import { describe, expect, it } from 'vitest';
import type { Appliance } from '../context/AppContext';
import { createSampleHistory } from '../data/demoHistory';
import type { UsageHistoryEntry } from '../types';
import {
  forecastHistorySeries,
  generateLocalHistoryForecast,
  getLocalHistoryStatus,
  observedDailyTotals,
} from './historyForecast';

const today = new Date(2024, 0, 15);
const appliance: Appliance = {
  id: 1,
  name: 'Test Load',
  type: 'other',
  location: 'Office',
  wattage: 100,
  hoursPerDay: 1,
  daysPerWeek: 7,
  isHighEfficiency: false,
  active: true,
  deleted: false,
};

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

function history(days: number, scope: 'household' | 'appliance' = 'appliance', kwh = 2): UsageHistoryEntry[] {
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - days + index);
    const dateString = isoDate(date);
    return {
      id: scope === 'household' ? `household:${dateString}` : `appliance:1:${dateString}`,
      date: dateString,
      scope,
      applianceId: scope === 'appliance' ? 1 : undefined,
      kwh,
      isSample: false,
    };
  });
}

describe('local deterministic history forecasts', () => {
  it('mirrors the shared cross-stack forecast fixture', () => {
    const fixture = domain.historyForecastExamples[0];
    const series = Array.from({ length: fixture.historyDays }, (_, index) =>
      fixture.repeatPattern[index % fixture.repeatPattern.length]);
    expect(forecastHistorySeries(series, fixture.forecastDays)).toEqual(fixture.expectedForecastKwh);
  });

  it('enforces 60/90-day availability and confidence thresholds', () => {
    expect(getLocalHistoryStatus([appliance], history(59), today)).toMatchObject({ available: false, historyDays: 59 });
    expect(getLocalHistoryStatus([appliance], history(60), today)).toMatchObject({ available: true, confidence: 'medium', granularity: 'appliance' });
    expect(getLocalHistoryStatus([appliance], history(90), today)).toMatchObject({ available: true, confidence: 'high', granularity: 'appliance' });
  });

  it('prefers complete appliance history and otherwise falls back to household totals', () => {
    const combined = [...history(59), ...history(90, 'household', 3)];
    expect(getLocalHistoryStatus([appliance], combined, today)).toMatchObject({ granularity: 'household', confidence: 'high' });
    expect(getLocalHistoryStatus([appliance], [...history(60), ...history(90, 'household')], today)).toMatchObject({ granularity: 'appliance' });
  });

  it('uses explicit household totals instead of double-counting appliance entries', () => {
    const entries: UsageHistoryEntry[] = [
      { id: 'a', date: '2024-01-14', scope: 'appliance', applianceId: 1, kwh: 4, isSample: true },
      { id: 'b', date: '2024-01-14', scope: 'appliance', applianceId: 2, kwh: 5, isSample: true },
      { id: 'h', date: '2024-01-14', scope: 'household', kwh: 7, isSample: false },
    ];
    expect(observedDailyTotals(entries)).toEqual([{ date: '2024-01-14', kwh: 7, isSample: false }]);
  });

  it('is repeatable and aggregates exact leap-month days with cost, currency, and carbon once', () => {
    const input = {
      appliances: [appliance],
      history: history(90),
      range: 'monthly' as const,
      electricityRate: 0.2,
      currency: 'EUR' as const,
      today,
    };
    const first = generateLocalHistoryForecast(input);
    const second = generateLocalHistoryForecast(input);
    expect(first).toEqual(second);
    expect(first.projections[0]).toMatchObject({
      date: '2024-02-01',
      daysInPeriod: 29,
      totalKwh: 58,
      estimatedCarbonKg: 22.852,
      currency: 'EUR',
      source: 'history-based',
    });
    expect(first.projections[0].totalCost).toBeCloseTo(11.6, 10);
    expect(first.projections.map(point => point.daysInPeriod)).toEqual([29, 31, 30, 31, 30, 31]);
  });

  it('creates 90 deterministic sample observations per sample appliance', () => {
    const first = createSampleHistory(today);
    const second = createSampleHistory(today);
    expect(first).toEqual(second);
    expect(first).toHaveLength(450);
    expect(new Set(first.map(entry => entry.date)).size).toBe(90);
  });
});
