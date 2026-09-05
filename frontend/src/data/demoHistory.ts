import { getKwhPerDay } from '../utils/energyCalculations';
import { usageHistoryId, type UsageHistoryEntry } from '../types';
import { SAMPLE_HOUSEHOLD } from './demoHousehold';

const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const scheduledToday = (type: string, day: number) => {
  if (type === 'computer') return day >= 1 && day <= 5;
  if (type === 'dishwasher') return [2, 3, 4, 5, 6].includes(day);
  if (type === 'washing-machine') return [1, 4, 6].includes(day);
  return true;
};

/** Ninety explicit, deterministic observations per sample appliance. */
export function createSampleHistory(today = new Date()): UsageHistoryEntry[] {
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const weekdayFactors = [0.96, 1.01, 0.99, 1.02, 1, 1.04, 0.98];

  return Array.from({ length: 90 }, (_, index) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (89 - index));
    const dateString = isoDate(date);
    const gentleTrend = 0.97 + index * 0.0006;

    return SAMPLE_HOUSEHOLD.map(appliance => {
      const runsToday = scheduledToday(appliance.type, date.getDay());
      const scheduledKwh = appliance.daysPerWeek < 7
        ? appliance.wattage * appliance.hoursPerDay / 1000
        : getKwhPerDay(appliance);
      const kwh = runsToday
        ? scheduledKwh * weekdayFactors[date.getDay()] * gentleTrend
        : 0;
      return {
        id: usageHistoryId(dateString, 'appliance', appliance.id),
        date: dateString,
        scope: 'appliance' as const,
        applianceId: appliance.id,
        kwh: Number(kwh.toFixed(6)),
        isSample: true,
      };
    });
  }).flat();
}
