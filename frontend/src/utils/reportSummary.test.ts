import { describe, expect, it } from 'vitest';
import type { UsageHistoryEntry } from '../types';
import { buildPrintableReportSummary } from './reportSummary';

const today = new Date(2024, 2, 10);
const entry = (date: string, kwh: number, isSample = false): UsageHistoryEntry => ({
  id: `household:${date}`, date, scope: 'household', kwh, isSample,
});

describe('printable report summaries', () => {
  it('uses only observed completed days and reports sample coverage', () => {
    const result = buildPrintableReportSummary({
      history: [entry('2024-03-08', 3, true), entry('2024-03-09', 4), entry('2024-03-10', 100)],
      totalDailyUsage: 2,
      electricityRate: 0.2,
      periodDays: 7,
      today,
    });
    expect(result).toMatchObject({ observedDays: 2, usesHistory: true, includesSample: true, kwh: 7 });
    expect(result.cost).toBeCloseTo(1.4);
    expect(result.carbonKg).toBeCloseTo(2.758);
  });

  it('falls back explicitly to an unblended formula total with no observations', () => {
    expect(buildPrintableReportSummary({
      history: [], totalDailyUsage: 2, electricityRate: 0.2, periodDays: 30, today,
    })).toMatchObject({ observedDays: 0, usesHistory: false, includesSample: false, kwh: 60, cost: 12 });
  });
});
