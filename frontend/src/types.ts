export type UsageHistoryEntry = {
  id: string;
  date: string;
  scope: 'household' | 'appliance';
  applianceId?: number;
  kwh: number;
  isSample: boolean;
};

export const usageHistoryId = (
  date: string,
  scope: UsageHistoryEntry['scope'],
  applianceId?: number,
) => `${scope}:${scope === 'appliance' ? applianceId : 'all'}:${date}`;
