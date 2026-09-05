import { useEffect, useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import EnergyUsageChart from '../components/EnergyUsageChart';
import TopConsumers from '../components/TopConsumers';
import WeeklyProjectionCard from '../components/WeeklyForecastCard';
import api from '../utils/api';
import { getAuthToken } from '../utils/auth';
import { calculateCarbonKg, CARBON_KG_PER_KWH, daysInYear } from '../utils/energyCalculations';

interface UsageSummary {
  totalKwh: number;
  totalCost: number;
  averageDailyKwh: number;
  estimatedCarbonKg: number;
  currency: 'USD' | 'EUR';
}

function InfoTooltip({ text }: { text: string }) {
  return (
    <span className="relative inline-block group" tabIndex={0}>
      <Info className="h-4 w-4 text-gray-400 cursor-pointer" />
      <span
        role="tooltip"
        className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block group-focus:block bg-gray-700 text-white text-xs rounded px-2 py-1 z-10 whitespace-nowrap"
      >
        {text}
      </span>
    </span>
  );
}

export default function Insights() {
  const {
    totalDailyUsage,
    settings,
    formatCost,
    costFromKwh,
    backendEnabled,
  } = useAppContext();
  const [loggedSummary, setLoggedSummary] = useState<UsageSummary | null>(null);
  const fullStackAvailable = backendEnabled && Boolean(getAuthToken());
  const year = new Date().getFullYear();
  const formulaAnnualKwh = totalDailyUsage * daysInYear(year);
  const formulaAnnualCost = costFromKwh(formulaAnnualKwh);
  const formulaAnnualCarbon = calculateCarbonKg(formulaAnnualKwh);

  useEffect(() => {
    if (!fullStackAvailable) {
      setLoggedSummary(null);
      return;
    }
    let cancelled = false;
    void api.get<UsageSummary>('energy-usage/summary', { params: { days: 30 } })
      .then(response => {
        if (!cancelled) setLoggedSummary(response.data);
      })
      .catch(() => {
        if (!cancelled) setLoggedSummary(null);
      });
    return () => { cancelled = true; };
  }, [fullStackAvailable]);

  const cards = useMemo(() => [
    {
      title: 'Estimated Daily Usage',
      value: `${totalDailyUsage.toFixed(2)} kWh`,
      tooltip: 'Formula Estimate from active appliance schedules and manual overrides.',
      source: 'Formula Estimate',
    },
    {
      title: `Annual Cost Projection (${year})`,
      value: formatCost(formulaAnnualCost),
      tooltip: `Formula Projection using ${daysInYear(year)} calendar days and your ${settings.currency}/kWh rate.`,
      source: 'Formula Projection',
    },
    {
      title: 'Annual Estimated Emissions Projection',
      value: `${formulaAnnualCarbon.toFixed(2)} kg CO₂`,
      tooltip: `Estimate using ${CARBON_KG_PER_KWH} kg CO₂/kWh; regional electricity emissions vary.`,
      source: 'Formula Projection',
    },
  ], [formatCost, formulaAnnualCarbon, formulaAnnualCost, settings.currency, totalDailyUsage, year]);

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Energy Insights</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Formula estimates describe current daily inputs; future values are Formula Projections. History-Based Forecasts appear only when qualifying recorded history is used.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {cards.map(card => (
          <div key={card.title} className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
            <h2 className="flex items-center gap-1 text-lg font-medium text-gray-700 dark:text-gray-300">
              {card.title} <InfoTooltip text={card.tooltip} />
            </h2>
            <p className="text-2xl font-semibold mt-1 text-gray-900 dark:text-white">{card.value}</p>
            <p className="mt-1 text-xs text-gray-500">{card.source}</p>
          </div>
        ))}
      </div>

      {loggedSummary && (
        <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
          <h2 className="font-medium">Recent Recorded Usage · Local Full-Stack Mode</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {loggedSummary.totalKwh.toFixed(2)} kWh total · {loggedSummary.averageDailyKwh.toFixed(2)} kWh average daily energy ·{' '}
            {formatCost(loggedSummary.totalCost)} · {loggedSummary.estimatedCarbonKg.toFixed(2)} kg CO₂ estimated emissions
          </p>
        </div>
      )}

      <TopConsumers topN={5} />
      <WeeklyProjectionCard />

      <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
        <h2 className="font-medium mb-4 text-gray-700 dark:text-gray-300">Future Energy Costs</h2>
        <EnergyUsageChart useEstimate />
      </div>
    </div>
  );
}
