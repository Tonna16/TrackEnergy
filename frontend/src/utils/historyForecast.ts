import type { Appliance } from '../context/AppContext';
import type { UsageHistoryEntry } from '../types';
import { calculateCarbonKg, calculateCost } from './energyCalculations';

export type HistoryConfidence = 'medium' | 'high';
export type HistoryGranularity = 'appliance' | 'household';
export type HistoryTimeRange = 'daily' | 'weekly' | 'monthly';

export type HistoryProjection = {
  date: string;
  weekStart?: string;
  weekEnd?: string;
  daysInPeriod: number;
  totalKwh: number;
  totalCost: number;
  estimatedCarbonKg: number;
  byAppKwh: Record<string, number>;
  byAppCost: Record<string, number>;
  currency: 'USD' | 'EUR';
  source: 'history-based';
};

export type LocalHistoryForecast = {
  status: 'available' | 'insufficient_history';
  source: 'history-based';
  confidence: HistoryConfidence | null;
  historyDays: number;
  requiredHistoryDays: 60;
  granularity: HistoryGranularity | null;
  explanation: string;
  projections: HistoryProjection[];
};

export type ObservedDailyTotal = {
  date: string;
  kwh: number;
  isSample: boolean;
};

const DAY_MS = 86_400_000;
const SEASON_LENGTH = 7;
const ALPHAS = [0.1, 0.3, 0.5];
const BETAS = [0.05, 0.1, 0.2];
const GAMMAS = [0.1, 0.15, 0.2];

const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate());
const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
const dateOrdinal = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS;
const daysBetween = (start: Date, end: Date) => Math.round(dateOrdinal(end) - dateOrdinal(start));
const mean = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
};

const validPastEntries = (history: UsageHistoryEntry[], today: Date) => {
  const yesterday = isoDate(addDays(startOfDay(today), -1));
  return history.filter(entry => entry.date <= yesterday && Number.isFinite(entry.kwh) && entry.kwh >= 0);
};

export function observedDailyTotals(history: UsageHistoryEntry[]): ObservedDailyTotal[] {
  const household = new Map<string, UsageHistoryEntry>();
  const applianceTotals = new Map<string, { kwh: number; isSample: boolean }>();
  history.forEach(entry => {
    if (entry.scope === 'household') {
      household.set(entry.date, entry);
    } else {
      const current = applianceTotals.get(entry.date) ?? { kwh: 0, isSample: true };
      applianceTotals.set(entry.date, {
        kwh: current.kwh + entry.kwh,
        isSample: current.isSample && entry.isSample,
      });
    }
  });

  return [...new Set([...household.keys(), ...applianceTotals.keys()])]
    .sort()
    .map(date => {
      const explicit = household.get(date);
      const summed = applianceTotals.get(date);
      return explicit
        ? { date, kwh: explicit.kwh, isSample: explicit.isSample }
        : { date, kwh: summed?.kwh ?? 0, isSample: summed?.isSample ?? false };
    });
}

function fillTrailingSixty(entries: UsageHistoryEntry[], today: Date) {
  const end = addDays(startOfDay(today), -1);
  const start = addDays(end, -59);
  const values = new Map(entries.map(entry => [entry.date, entry.kwh]));
  const series = Array.from({ length: 60 }, (_, index) => values.get(isoDate(addDays(start, index))) ?? null);
  const known = series.flatMap(value => value === null ? [] : [value]);
  if (!known.length) return Array<number>(60).fill(0);

  const first = series.findIndex(value => value !== null);
  let last = series.length - 1;
  while (last >= 0 && series[last] === null) last -= 1;
  for (let index = 0; index < first; index += 1) series[index] = series[first];
  for (let index = last + 1; index < series.length; index += 1) series[index] = series[last];
  let index = first + 1;
  while (index < last) {
    if (series[index] !== null) {
      index += 1;
      continue;
    }
    const left = index - 1;
    let right = index;
    while (right <= last && series[right] === null) right += 1;
    const leftValue = series[left] ?? mean(known);
    const rightValue = series[right] ?? leftValue;
    for (let step = 1; step < right - left; step += 1) {
      series[left + step] = leftValue + (rightValue - leftValue) * step / (right - left);
    }
    index = right + 1;
  }
  return series.map(value => value ?? mean(known));
}

function removeOutliers(series: number[]) {
  if (series.length < 4) return [...series];
  const sorted = [...series].sort((left, right) => left - right);
  const q1 = sorted[Math.floor(sorted.length / 4)];
  const q3 = sorted[Math.floor(3 * sorted.length / 4)];
  const median = sorted[Math.floor(sorted.length / 2)];
  const iqr = q3 - q1;
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  return series.map(value => value < lower || value > upper ? median : value);
}

function initializeHoltWinters(series: number[], alpha: number, beta: number, gamma: number) {
  const completeSeasons = Math.floor(series.length / SEASON_LENGTH);
  const seasonMeans = Array.from({ length: completeSeasons }, (_, season) =>
    mean(series.slice(season * SEASON_LENGTH, (season + 1) * SEASON_LENGTH)));
  const seasonal = Array<number>(SEASON_LENGTH).fill(0);
  for (let slot = 0; slot < SEASON_LENGTH; slot += 1) {
    const offsets: number[] = [];
    for (let index = slot; index < series.length; index += SEASON_LENGTH) {
      const season = Math.floor(index / SEASON_LENGTH);
      if (season < completeSeasons && seasonMeans[season] > 0) offsets.push(series[index] - seasonMeans[season]);
    }
    seasonal[slot] = mean(offsets);
  }

  let level = seasonMeans[0] ?? series[0];
  let trend = completeSeasons >= 2 ? (seasonMeans[1] - seasonMeans[0]) / SEASON_LENGTH : 0;
  series.forEach((value, index) => {
    const slot = index % SEASON_LENGTH;
    const previousLevel = level;
    const previousSeason = seasonal[slot];
    level = alpha * (value - previousSeason) + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
    seasonal[slot] = gamma * (value - level) + (1 - gamma) * previousSeason;
  });
  return { level, trend, seasonal };
}

function holtLinear(series: number[], count: number, alpha: number, beta: number) {
  let level = series[0];
  let trend = (series[Math.min(series.length - 1, SEASON_LENGTH)] - series[0]) /
    Math.min(series.length, SEASON_LENGTH);
  for (let index = 1; index < series.length; index += 1) {
    const previousLevel = level;
    level = alpha * series[index] + (1 - alpha) * (level + trend);
    trend = beta * (level - previousLevel) + (1 - beta) * trend;
  }
  return Array.from({ length: count }, (_, index) =>
    Math.max(0, level + trend * (index + 1) * 0.9 ** (index + 1)));
}

function holtWinters(series: number[], count: number, alpha: number, beta: number, gamma: number) {
  const state = initializeHoltWinters(series, alpha, beta, gamma);
  return Array.from({ length: count }, (_, index) => {
    const step = index + 1;
    const season = state.seasonal[(series.length + index) % SEASON_LENGTH];
    return Math.max(0, state.level + step * state.trend * 0.95 ** step + season);
  });
}

const mae = (actual: number[], predicted: number[]) =>
  mean(actual.map((value, index) => Math.abs(value - (predicted[index] ?? 0))));

function tunedForecast(series: number[], count: number) {
  if (series.every(value => value === 0)) return Array<number>(count).fill(0);
  const cleaned = removeOutliers(series);
  if (cleaned.length < 3) return Array<number>(count).fill(mean(cleaned));
  const holdout = Math.max(1, Math.min(7, Math.floor(cleaned.length / 4)));
  const train = cleaned.slice(0, -holdout);
  const actual = cleaned.slice(-holdout);

  if (cleaned.length < 2 * SEASON_LENGTH) {
    let best = { alpha: 0.3, beta: 0.1, error: Number.POSITIVE_INFINITY };
    ALPHAS.forEach(alpha => BETAS.forEach(beta => {
      const error = mae(actual, holtLinear(train, holdout, alpha, beta));
      if (error < best.error) best = { alpha, beta, error };
    }));
    return holtLinear(cleaned, count, best.alpha, best.beta);
  }

  let best = { alpha: 0.3, beta: 0.1, gamma: 0.15, error: Number.POSITIVE_INFINITY };
  ALPHAS.forEach(alpha => BETAS.forEach(beta => GAMMAS.forEach(gamma => {
    const error = mae(actual, holtWinters(train, holdout, alpha, beta, gamma));
    if (error < best.error) best = { alpha, beta, gamma, error };
  })));
  const raw = holtWinters(cleaned, count, best.alpha, best.beta, best.gamma);
  const average = mean(cleaned);
  const deviation = standardDeviation(cleaned);
  const lower = Math.max(0, average - 3 * deviation);
  const upper = average + 3 * deviation;
  return raw.map(value => Math.max(lower, Math.min(upper, value)));
}

/** Public cross-stack fixture seam for deterministic forecast parity tests. */
export const forecastHistorySeries = (series: number[], count: number): number[] =>
  tunedForecast(series, count);

type Interval = { start: Date; end: Date; weekly: boolean };

function intervals(range: HistoryTimeRange, today: Date): Interval[] {
  const base = startOfDay(today);
  if (range === 'daily') {
    return Array.from({ length: 30 }, (_, index) => {
      const date = addDays(base, index + 1);
      return { start: date, end: date, weekly: false };
    });
  }
  if (range === 'weekly') {
    const daysAhead = ((8 - base.getDay()) % 7) || 7;
    const firstMonday = addDays(base, daysAhead);
    return Array.from({ length: 4 }, (_, index) => {
      const start = addDays(firstMonday, index * 7);
      return { start, end: addDays(start, 6), weekly: true };
    });
  }
  return Array.from({ length: 6 }, (_, index) => {
    const start = new Date(base.getFullYear(), base.getMonth() + index + 1, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
    return { start, end, weekly: false };
  });
}

export function getLocalHistoryStatus(
  appliances: Appliance[],
  history: UsageHistoryEntry[],
  today = new Date(),
) {
  const active = appliances.filter(appliance => appliance.active !== false && !appliance.deleted);
  const valid = validPastEntries(history, today);
  const householdDays = new Set(valid.filter(entry => entry.scope === 'household').map(entry => entry.date)).size;
  const applianceDays = active.map(appliance =>
    new Set(valid.filter(entry => entry.scope === 'appliance' && entry.applianceId === appliance.id).map(entry => entry.date)).size);
  const minimumApplianceDays = applianceDays.length ? Math.min(...applianceDays) : 0;
  const granularity: HistoryGranularity | null = active.length && minimumApplianceDays >= 60
    ? 'appliance'
    : householdDays >= 60 ? 'household' : null;
  const historyDays = granularity === 'appliance' ? minimumApplianceDays : granularity === 'household'
    ? householdDays : Math.max(minimumApplianceDays, householdDays);
  return {
    available: granularity !== null,
    granularity,
    historyDays,
    confidence: granularity ? (historyDays >= 90 ? 'high' : 'medium') as HistoryConfidence : null,
  };
}

export function generateLocalHistoryForecast({
  appliances,
  history,
  range,
  electricityRate,
  currency,
  today = new Date(),
}: {
  appliances: Appliance[];
  history: UsageHistoryEntry[];
  range: HistoryTimeRange;
  electricityRate: number;
  currency: 'USD' | 'EUR';
  today?: Date;
}): LocalHistoryForecast {
  const status = getLocalHistoryStatus(appliances, history, today);
  if (!status.available || !status.granularity) {
    return {
      status: 'insufficient_history',
      source: 'history-based',
      confidence: null,
      historyDays: status.historyDays,
      requiredHistoryDays: 60,
      granularity: null,
      explanation: `History-Based Forecast needs 60 valid past daily observations. ${status.historyDays} available.`,
      projections: [],
    };
  }

  const projectionIntervals = intervals(range, today);
  const forecastStart = addDays(startOfDay(today), 1);
  const finalInterval = projectionIntervals[projectionIntervals.length - 1];
  const horizon = daysBetween(forecastStart, finalInterval.end) + 1;
  const valid = validPastEntries(history, today);
  const active = appliances.filter(appliance => appliance.active !== false && !appliance.deleted);
  const forecasts = new Map<number | 'household', number[]>();
  if (status.granularity === 'appliance') {
    active.forEach(appliance => {
      const entries = valid.filter(entry => entry.scope === 'appliance' && entry.applianceId === appliance.id);
      forecasts.set(appliance.id, tunedForecast(fillTrailingSixty(entries, today), horizon));
    });
  } else {
    const entries = valid.filter(entry => entry.scope === 'household');
    forecasts.set('household', tunedForecast(fillTrailingSixty(entries, today), horizon));
  }

  const projections = projectionIntervals.map(interval => {
    const startIndex = daysBetween(forecastStart, interval.start);
    const daysInPeriod = daysBetween(interval.start, interval.end) + 1;
    const byAppKwh: Record<string, number> = {};
    let totalKwh = 0;
    if (status.granularity === 'appliance') {
      active.forEach(appliance => {
        const series = forecasts.get(appliance.id) ?? [];
        const value = series.slice(startIndex, startIndex + daysInPeriod).reduce((sum, point) => sum + point, 0);
        byAppKwh[appliance.name] = value;
        totalKwh += value;
      });
    } else {
      const series = forecasts.get('household') ?? [];
      totalKwh = series.slice(startIndex, startIndex + daysInPeriod).reduce((sum, point) => sum + point, 0);
    }
    const byAppCost = Object.fromEntries(Object.entries(byAppKwh).map(([name, kwh]) => [name, calculateCost(kwh, electricityRate)]));
    return {
      date: isoDate(interval.start),
      weekStart: interval.weekly ? isoDate(interval.start) : undefined,
      weekEnd: interval.weekly ? isoDate(interval.end) : undefined,
      daysInPeriod,
      totalKwh,
      totalCost: calculateCost(totalKwh, electricityRate),
      estimatedCarbonKg: calculateCarbonKg(totalKwh),
      byAppKwh,
      byAppCost,
      currency,
      source: 'history-based' as const,
    };
  });

  return {
    status: 'available',
    source: 'history-based',
    confidence: status.confidence,
    historyDays: status.historyDays,
    requiredHistoryDays: 60,
    granularity: status.granularity,
    explanation: `Deterministic Holt/Holt-Winters forecast from ${status.historyDays} days of ${status.granularity} history.`,
    projections,
  };
}
