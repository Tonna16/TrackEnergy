import type { Appliance } from '../context/AppContext';
import {
  calculateCarbonKg,
  calculateCost,
  daysInMonth,
  daysInYear,
  getKwhPerDay,
  totalDailyKwh,
} from './energyCalculations';

export { getKwhPerDay, getKwhPerMonth, getKwhPerWeek } from './energyCalculations';

export type ConfidenceTier = 'high' | 'medium' | 'low';

export type UsageHistoryPoint = {
  date: string;
  kWhUsed: number;
  applianceId?: number;
  applianceName?: string;
  byApplianceKwh?: Record<string, number>;
};

export type ChartPoint = {
  date: string;
  total?: number;
  confidence?: ConfidenceTier;
  isEstimated?: boolean;
  daysInPeriod?: number;
} & Record<string, number | string | boolean | undefined>;

const isoDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const nextMonday = (today: Date): Date => {
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const daysAhead = ((8 - date.getDay()) % 7) || 7;
  date.setDate(date.getDate() + daysAhead);
  return date;
};

/** Generate deterministic future Formula Projection cost points. */
export function generateEstimate({
  appliances,
  costFromKwh,
  count,
  daysPer,
  monthly = false,
  includeInactive = false,
}: {
  appliances: Appliance[];
  costFromKwh: (kwh: number) => number;
  count: number;
  daysPer: number;
  monthly?: boolean;
  includeInactive?: boolean;
}): ChartPoint[] {
  const today = new Date();
  const weekly = !monthly && daysPer === 7;
  const firstWeek = weekly ? nextMonday(today) : null;

  return Array.from({ length: count }, (_, index) => {
    let date: Date;
    let periodDays: number;
    if (monthly) {
      date = new Date(today.getFullYear(), today.getMonth() + index + 1, 1);
      periodDays = daysInMonth(date.getFullYear(), date.getMonth());
    } else if (weekly && firstWeek) {
      date = new Date(firstWeek);
      date.setDate(date.getDate() + index * 7);
      periodDays = 7;
    } else {
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index + 1);
      periodDays = Math.max(1, daysPer);
    }

    const values: Record<string, number> = {};
    let total = 0;
    appliances.forEach(appliance => {
      if (appliance.deleted || (!includeInactive && appliance.active === false)) return;
      const cost = costFromKwh(getKwhPerDay(appliance) * periodDays);
      values[appliance.name] = cost;
      total += cost;
    });

    return {
      date: isoDate(date),
      total,
      ...values,
      confidence: 'high',
      isEstimated: true,
      daysInPeriod: periodDays,
    };
  });
}

export function estimateAnnualFromAppliances({
  appliances,
  electricityRate,
  year = new Date().getFullYear(),
}: {
  appliances: Appliance[];
  electricityRate: number;
  year?: number;
}) {
  const annualKwh = totalDailyKwh(appliances) * daysInYear(year);
  return {
    annualKwh,
    annualCost: calculateCost(annualKwh, electricityRate),
    annualCarbon: calculateCarbonKg(annualKwh),
  };
}
