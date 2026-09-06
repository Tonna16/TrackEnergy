import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts';
import { Plus } from 'lucide-react';
import api from '../utils/api';
import { getAuthToken } from '../utils/auth';
import { useAppContext } from '../context/AppContext';
import { generateEstimate, type ChartPoint } from '../utils/energyEstimator';
import { generateLocalHistoryForecast } from '../utils/historyForecast';

interface Props {
  height?: number;
  useEstimate: boolean;
  onAverageCostChange?: (avgCost: number) => void;
}

type TimeRange = 'daily' | 'weekly' | 'monthly';
type ForecastSource = 'formula' | 'history';

interface ProjectionResponse {
  date: string;
  totalKwh: number;
  totalCost: number;
  byAppCost: Record<string, number>;
  daysInPeriod?: number;
  source?: 'formula-estimate' | 'history-based';
}

interface HistoryForecastResponse {
  status: 'available' | 'insufficient_history';
  source: 'history-based';
  dataCoverage: string;
  historyDays: number;
  recentHistoryDays: number;
  requiredHistoryDays: number;
  explanation?: string;
  projections: ProjectionResponse[];
}

const MAX_COST = 10_000;
const META_KEYS = new Set(['date', 'total', 'confidence', 'isEstimated', 'daysInPeriod']);

export default function EnergyUsageChart({
  height = 480,
  useEstimate,
  onAverageCostChange,
}: Props) {
  const {
    appliances,
    trackedAppliances,
    symbol,
    settings,
    costFromKwh,
    backendEnabled,
    demoMode,
    historyEntries,
  } = useAppContext();
  const fullStackAvailable = backendEnabled && Boolean(getAuthToken());
  const [timeRange, setTimeRange] = useState<TimeRange>('daily');
  const [forecastSource, setForecastSource] = useState<ForecastSource>('formula');
  const [viewMode, setViewMode] = useState<'total' | 'perAppliance'>('total');
  const [cumulative, setCumulative] = useState(false);
  const [visibleApps, setVisibleApps] = useState<string[]>([]);
  const [showAverage, setShowAverage] = useState(true);
  const [serverData, setServerData] = useState<ProjectionResponse[]>([]);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [historyCoverage, setHistoryCoverage] = useState<string | null>(null);

  const localData = useMemo(() => generateEstimate({
    appliances: trackedAppliances,
    costFromKwh,
    count: timeRange === 'daily' ? 30 : timeRange === 'weekly' ? 4 : 6,
    daysPer: timeRange === 'weekly' ? 7 : 1,
    monthly: timeRange === 'monthly',
  }), [costFromKwh, timeRange, trackedAppliances]);

  const localHistory = useMemo(() => generateLocalHistoryForecast({
    appliances,
    history: historyEntries ?? [],
    range: timeRange,
    electricityRate: settings.electricityRate,
    currency: settings.currency,
  }), [appliances, historyEntries, settings.currency, settings.electricityRate, timeRange]);

  useEffect(() => {
    if (!demoMode || forecastSource !== 'history') return;
    if (localHistory.status === 'available') {
      setHistoryCoverage(localHistory.dataCoverage);
      setHistoryMessage(null);
      if (localHistory.granularity === 'household') setViewMode('total');
    } else {
      setHistoryCoverage(null);
      setHistoryMessage(`${localHistory.explanation} Showing Formula Projection instead.`);
      setForecastSource('formula');
    }
  }, [demoMode, forecastSource, localHistory]);

  useEffect(() => {
    if (demoMode) {
      setServerData([]);
      return;
    }
    if (!fullStackAvailable) {
      setForecastSource('formula');
      setServerData([]);
      return;
    }

    let cancelled = false;
    const url = forecastSource === 'history'
      ? 'energy-usage/history-forecast'
      : 'energy-usage/projections';
    void api.get<ProjectionResponse[] | HistoryForecastResponse>(url, { params: { timeRange } })
      .then(response => {
        if (cancelled) return;
        if (forecastSource === 'history' && !Array.isArray(response.data)) {
          const history = response.data;
          if (history.status === 'available') {
            setServerData(history.projections);
            setHistoryCoverage(history.dataCoverage);
            setHistoryMessage(null);
          } else {
            setServerData([]);
            setHistoryCoverage(null);
            setHistoryMessage(
              history.explanation ??
              `History-Based Forecast needs an observation on each of the latest ${history.requiredHistoryDays} completed days for every active appliance.`,
            );
            setForecastSource('formula');
          }
          return;
        }
        setServerData(Array.isArray(response.data) ? response.data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setServerData([]);
        if (forecastSource === 'history') {
          setHistoryMessage('History-Based Forecast is unavailable. Showing the Formula Projection.');
          setForecastSource('formula');
        }
      });
    return () => { cancelled = true; };
  }, [forecastSource, fullStackAvailable, timeRange, appliances, demoMode]);

  const projectionData = demoMode && forecastSource === 'history' && localHistory.status === 'available'
    ? localHistory.projections
    : serverData;
  const hasProjectionData = projectionData.length > 0 && (
    (demoMode && forecastSource === 'history') || fullStackAvailable
  );
  const chartData = useMemo<ChartPoint[]>(() => {
    const raw: ChartPoint[] = hasProjectionData
      ? projectionData.map(projection => ({
          date: projection.date,
          total: Math.min(projection.totalCost, MAX_COST),
          ...Object.fromEntries(
            Object.entries(projection.byAppCost ?? {}).map(([name, cost]) => [name, Math.min(cost, MAX_COST)]),
          ),
          daysInPeriod: projection.daysInPeriod,
          isEstimated: true,
        }))
      : localData;
    if (!cumulative) return raw;

    const sums: Record<string, number> = {};
    return raw.map(row => {
      const output: ChartPoint = { date: row.date };
      Object.entries(row).forEach(([key, value]) => {
        if (META_KEYS.has(key) || typeof value !== 'number') return;
        sums[key] = (sums[key] ?? 0) + value;
        output[key] = sums[key];
      });
      return output;
    });
  }, [cumulative, hasProjectionData, localData, projectionData]);

  const selectableApplianceKeys = useMemo(() => {
    const keys = new Set<string>();
    chartData.forEach(row => Object.keys(row).forEach(key => {
      if (!META_KEYS.has(key)) keys.add(key);
    }));
    return [...keys];
  }, [chartData]);

  useEffect(() => {
    const selected = visibleApps[0];
    if (!selectableApplianceKeys.length) {
      if (selected) setVisibleApps([]);
    } else if (!selected || !selectableApplianceKeys.includes(selected)) {
      setVisibleApps([selectableApplianceKeys[0]]);
    }
  }, [selectableApplianceKeys, visibleApps]);

  const activePerApplianceKey = visibleApps[0];
  const activeKey = viewMode === 'total' ? 'total' : activePerApplianceKey;
  const averageCost = useMemo(() => {
    const values = chartData
      .map(row => row[activeKey || 'total'])
      .filter((value): value is number => typeof value === 'number');
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
  }, [activeKey, chartData]);

  useEffect(() => {
    onAverageCostChange?.(averageCost);
  }, [averageCost, onAverageCostChange]);

  if (!trackedAppliances.length && !(demoMode && localHistory.status === 'available')) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-offwhite-50 dark:bg-gray-800 rounded-lg">
        <p className="mb-4 text-gray-700 dark:text-offwhite-50">No active appliances are included in Formula Projections.</p>
        <Link to="/add-appliance" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          <Plus className="w-5 h-5 mr-2" /> Add Appliance
        </Link>
      </div>
    );
  }

  const colors = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#14b8a6', '#8b5cf6'];
  const colorIndex = viewMode === 'total' ? 0 : trackedAppliances.findIndex(appliance => appliance.name === activeKey) + 1;
  const activeColor = colors[colorIndex % colors.length];
  const sourceLabel = forecastSource === 'history' && hasProjectionData
    ? `History-Based Forecast${historyCoverage ? ` · ${historyCoverage}` : ''}${
        demoMode && historyEntries?.some(entry => entry.isSample) ? ' · sample data' : ''
      }`
    : 'Formula Projection';

  return (
    <div className="space-y-4 p-4 rounded-lg bg-white dark:bg-gray-900 shadow" style={{ height }}>
      <div className="bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-4 py-2 rounded">
        {sourceLabel}. {forecastSource === 'history' && hasProjectionData
          ? 'This deterministic forecast uses recorded history only; Formula Projection values are not blended into it. Data coverage does not measure forecast accuracy.'
          : useEstimate && 'Future values are projections based on appliance schedules and the configured electricity rate.'}
      </div>
      {backendEnabled && <p className="text-sm text-gray-500">
        Server history forecast (API-only): enter history through the authenticated local API.
        Usage History entry is available in Local Demo; browser history is not synchronized to the server.
      </p>}
      {historyMessage && (
        <div role="status" className="bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200 px-4 py-2 rounded">
          {historyMessage}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-2">
        {(demoMode || fullStackAvailable) && (
          <select
            aria-label="Projection or forecast source"
            value={forecastSource}
            onChange={event => {
              const nextSource = event.target.value as ForecastSource;
              if (nextSource === 'formula') setHistoryMessage(null);
              setForecastSource(nextSource);
            }}
            className="border rounded px-2 py-1"
          >
            <option value="formula">Formula Projection</option>
            <option value="history" disabled={demoMode && localHistory.status !== 'available'}>
              {demoMode && localHistory.status !== 'available'
                ? `History-Based Forecast (${localHistory.recentHistoryDays}/60 days)`
                : backendEnabled ? 'History-Based Forecast (API-only history)' : 'History-Based Forecast'}
            </option>
          </select>
        )}
        <select value={timeRange} onChange={event => setTimeRange(event.target.value as TimeRange)} className="border rounded px-2 py-1">
          <option value="daily">Next 30 Days</option>
          <option value="weekly">Next 4 Weeks</option>
          <option value="monthly">Next 6 Full Months</option>
        </select>
        <select
          value={viewMode}
          onChange={event => setViewMode(event.target.value as 'total' | 'perAppliance')}
          className="border rounded px-2 py-1"
        >
          <option value="total">Total Cost</option>
          <option
            value="perAppliance"
            disabled={demoMode && forecastSource === 'history' && localHistory.granularity === 'household'}
          >
            Per Appliance
          </option>
        </select>
        {viewMode === 'perAppliance' && (
          <select
            value={activePerApplianceKey || ''}
            onChange={event => setVisibleApps(event.target.value ? [event.target.value] : [])}
            className="border rounded px-2 py-1"
            aria-label="Select appliance series"
            disabled={!selectableApplianceKeys.length}
          >
            {selectableApplianceKeys.map(key => <option key={key} value={key}>{key}</option>)}
          </select>
        )}
        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={cumulative} onChange={() => setCumulative(value => !value)} />
          <span>Cumulative</span>
        </label>
        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={showAverage} onChange={() => setShowAverage(value => !value)} />
          <span>Show Average</span>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={height - 180}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 60, left: 50 }}>
          <XAxis dataKey="date" stroke="currentColor" />
          <YAxis
            stroke="currentColor"
            domain={[0, (dataMax: number) => Math.max(0.05, Math.ceil((Number.isFinite(dataMax) ? dataMax : 0) / 0.05) * 0.05)]}
            tickFormatter={value => value.toFixed(2)}
            label={{ value: `Cost (${settings.currency})`, angle: -90, position: 'insideLeft', dx: -10, dy: 25 }}
          />
          <Tooltip
            formatter={(value: number) => `${symbol}${value.toFixed(2)}`}
            contentStyle={{ backgroundColor: settings.darkMode ? '#1f2937' : '#fff' }}
          />
          {showAverage && <ReferenceLine y={averageCost} stroke="#888" strokeDasharray="3 3" />}
          {viewMode === 'total' ? (
            <Line type="monotone" dataKey="total" stroke={colors[0]} dot={false} />
          ) : (
            visibleApps.map(name => {
              const index = appliances.findIndex(appliance => appliance.name === name);
              return <Line key={name} type="monotone" dataKey={name} stroke={colors[(index + 1) % colors.length]} dot={false} />;
            })
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex justify-center items-center space-x-2 mt-4">
        <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: activeColor }} />
        <span className="text-sm">{activeKey === 'total' ? 'Total' : activeKey}</span>
        {showAverage && <span className="ml-6 text-sm text-gray-600 dark:text-gray-400">Avg: {symbol}{averageCost.toFixed(2)}</span>}
      </div>
    </div>
  );
}
