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

  it('requires complete recent training coverage and reports coverage without confidence claims', () => {
    expect(getLocalHistoryStatus([appliance], history(59), today)).toMatchObject({ available: false, historyDays: 59 });
    expect(getLocalHistoryStatus([appliance], history(60), today)).toMatchObject({ available: true, historyDays: 60, recentHistoryDays: 60, granularity: 'appliance' });
    expect(getLocalHistoryStatus([appliance], history(120), today)).toMatchObject({ available: true, historyDays: 90, recentHistoryDays: 60, granularity: 'appliance', dataCoverage: '90/90 completed days recorded; 60/60 in the latest training window' });
  });

  it('prefers complete appliance history and otherwise falls back to household totals', () => {
    const combined = [...history(59), ...history(90, 'household', 3)];
    expect(getLocalHistoryStatus([appliance], combined, today)).toMatchObject({ granularity: 'household', historyDays: 90 });
    expect(getLocalHistoryStatus([appliance], [...history(60), ...history(90, 'household')], today)).toMatchObject({ granularity: 'appliance' });
  });

  it.each(['appliance', 'household'] as const)('rejects 60 observations over a year old for %s forecasts', scope => {
    const old = history(60, scope).map(entry => ({
      ...entry, date: isoDate(new Date(new Date(`${entry.date}T00:00:00`).getTime() - 400 * 86_400_000)),
    }));
    for (const entries of [old, [...old, ...history(1, scope)]]) {
      const result = generateLocalHistoryForecast({ appliances: [appliance], history: entries, range: 'daily', electricityRate: 0.2, currency: 'USD', today });
      expect(result.status).toBe('insufficient_history');
      expect(result.historyDays).toBe(entries.length - 60);
      expect(result.projections).toEqual([]);
    }
  });

  it('rejects sparse, duplicate, invalid, current and future observations even with 60 older qualifying days', () => {
    const sparse = history(90).filter((_, index) => index % 3 !== 0);
    expect(sparse).toHaveLength(60);
    expect(getLocalHistoryStatus([appliance], sparse, today)).toMatchObject({ available: false, historyDays: 60, recentHistoryDays: 40 });
    const incomplete = history(60).slice(0, -1);
    const invalid = ['2024-01-15', '2024-01-16', '2023-11-31'].map(date => ({ ...incomplete[0], date }));
    expect(getLocalHistoryStatus([appliance], [...incomplete, ...incomplete, ...invalid], today)).toMatchObject({ available: false, recentHistoryDays: 59 });
    expect(getLocalHistoryStatus([appliance], history(60).map((entry, index) => index === 0 ? { ...entry, kwh: NaN } : entry), today).available).toBe(false);
  });

  it('allows an explicit zero forecast only with complete recent observations', () => {
    const result = generateLocalHistoryForecast({ appliances: [appliance], history: history(60, 'appliance', 0), range: 'daily', electricityRate: 0.2, currency: 'USD', today });
    expect(result.status).toBe('available');
    expect(result.projections).toHaveLength(30);
    expect(result.projections.every(point => point.totalKwh === 0)).toBe(true);
    expect(result).not.toHaveProperty('confidence');
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
