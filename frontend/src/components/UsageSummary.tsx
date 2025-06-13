// src/components/UsageSummary.tsx
import React, { useMemo, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import EnergyTip from './EnergyTip';
import { nationalAverages } from '../data/applianceDatabase';
import {
  Lightbulb,
  DollarSign,
  Zap,
  TrendingDown,
  Info,
} from 'lucide-react';

type UsageSummaryProps = {
  useEstimate: boolean;
};

export default function UsageSummary({ useEstimate }: UsageSummaryProps) {
  const {
    totalDailyUsage,
    totalDailyCost,
    settings: { householdSize, currency },
  } = useAppContext();

  const symbol = currency === 'USD' ? '$' : '€';

  const baselineDaily = useMemo(() => {
    const bySize = nationalAverages.by_household_size;
    const sizeKey = householdSize >= 5 ? 5 : householdSize;
    return bySize[sizeKey] ?? nationalAverages.daily;
  }, [householdSize]);

  const efficiencyPercent = useMemo(() => {
    if (baselineDaily <= 0) return -1;  // Changed from 100 to -1 to indicate no baseline
    if (useEstimate) return 100;
    const ratio = (baselineDaily - totalDailyUsage) / baselineDaily;
    const percent = Math.max(0, Math.min(100, ratio * 100));
    return Math.round(percent);
  }, [baselineDaily, totalDailyUsage, useEstimate]);

  // Determine color class for efficiency % text
  const getEfficiencyColor = (percent: number) => {
    if (percent < 0) return 'text-gray-400'; // no baseline
    if (percent < 50) return 'text-red-600 dark:text-red-400';
    if (percent <= 80) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-green-600 dark:text-green-400';
  };

  // Tooltip state
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Daily Usage */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Daily Usage
          </h3>
          <Lightbulb className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {totalDailyUsage.toFixed(2)} kWh{useEstimate && ' (est.)'}
        </p>
      </div>

      {/* Daily Cost */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Daily Cost
          </h3>
          <DollarSign className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-2xl font-semibold text-gray-900 dark:text-white">
          {symbol}{totalDailyCost.toFixed(2)}{useEstimate && ' (est.)'}
        </p>
      </div>

      {/* Efficiency % */}
      <div className="relative bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 flex items-center">
            Efficiency (%)
            <Info
              className="h-4 w-4 ml-1 text-gray-400 cursor-pointer"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              aria-label="Efficiency info"
              role="tooltip-trigger"
            />
          </h3>
          <Zap className="h-6 w-6 text-emerald-500" />
        </div>

        {/* Tooltip */}
        {showTooltip && (
          <div
            className="absolute top-8 left-0 bg-gray-700 text-white text-xs rounded px-2 py-1 w-48 z-10"
            role="tooltip"
          >
            Efficiency compares your daily energy use to the average for your household size. Higher means better energy savings.
          </div>
        )}

        {/* Efficiency value or no baseline message */}
        {efficiencyPercent < 0 ? (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            No baseline data available
          </p>
        ) : (
          <p
            className={`mt-2 text-2xl font-semibold ${getEfficiencyColor(
              efficiencyPercent
            )}`}
          >
            {efficiencyPercent}%
          </p>
        )}
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          Compared to {householdSize}-person average
        </p>
      </div>

      {/* Tip */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 flex flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Energy-Saving Tip
          </h3>
          <TrendingDown className="h-6 w-6 text-emerald-500" />
        </div>
        <p className="mt-2 text-sm text-gray-900 dark:text-gray-100">
          <EnergyTip />
        </p>
      </div>
    </div>
  );
}
