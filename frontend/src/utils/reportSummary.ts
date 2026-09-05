import type { UsageHistoryEntry } from '../types';
import { calculateCarbonKg, calculateCost } from './energyCalculations';
import { observedDailyTotals } from './historyForecast';

export type PrintableReportSummary = {
  startDate: string;
  endDate: string;
  observedDays: number;
  periodDays: 7 | 30;
  usesHistory: boolean;
  includesSample: boolean;
  kwh: number;
  cost: number;
  carbonKg: number;
};

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const addDays = (date: Date, days: number) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function buildPrintableReportSummary({
  history,
  totalDailyUsage,
  electricityRate,
  periodDays,
  today = new Date(),
}: {
  history: UsageHistoryEntry[];
  totalDailyUsage: number;
  electricityRate: number;
  periodDays: 7 | 30;
  today?: Date;
}): PrintableReportSummary {
  const end = addDays(today, -1);
  const start = addDays(end, -(periodDays - 1));
  const startDate = isoDate(start);
  const endDate = isoDate(end);
  const observed = observedDailyTotals(history)
    .filter(entry => entry.date >= startDate && entry.date <= endDate);
  const observedDays = observed.length;
  const usesHistory = observedDays > 0;
  const kwh = usesHistory
    ? observed.reduce((sum, entry) => sum + entry.kwh, 0)
    : totalDailyUsage * periodDays;

  return {
    startDate,
    endDate,
    observedDays,
    periodDays,
    usesHistory,
    includesSample: usesHistory && observed.some(entry => entry.isSample),
    kwh,
    cost: calculateCost(kwh, electricityRate),
    carbonKg: calculateCarbonKg(kwh),
  };
}
