// src/components/EnergyUsageChart.tsx
import { useState, useEffect, useMemo } from 'react';
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
import { useAppContext } from '../context/AppContext';
import type { Appliance } from '../context/AppContext';
import { Plus } from 'lucide-react';
import api from '../utils/api';

const COLORS = [
  '#10b981', // total
  '#6366f1',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#14b8a6',
  '#f43f5e',
];
const SEASONAL: Record<number, number> = {
  0: 1.05, 1: 1.02, 2: 0.98, 3: 0.95,
  4: 1.0, 5: 1.1, 6: 1.15, 7: 1.15,
  8: 1.05, 9: 1.0, 10: 0.98, 11: 1.05,
};
const NOISE_BOUND = 0.05; // ±5%

function xfnv1a(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a: number) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface EnergyUsageChartProps {
  height?: number;
  useEstimate: boolean;
}
type ChartPoint = { date: string; [key: string]: number | string };

export default function EnergyUsageChart({
  height = 480,
  useEstimate,
}: EnergyUsageChartProps) {
  const { appliances, symbol, settings, convertCost } = useAppContext();
  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [viewMode, setViewMode] = useState<'total' | 'perAppliance'>('total');
  const [cumulative, setCumulative] = useState(false);
  const [visibleApps, setVisibleApps] = useState<string[]>([]);
  const [showAverage, setShowAverage] = useState(true);
  const [serverData, setServerData] = useState<
    { date: string; totalCost: number; byAppCost: Record<string, number> }[]
  >([]);

  // Fetch projections from the server
  useEffect(() => {
    console.log(`[EnergyUsageChart] Fetching projections: timeRange=${timeRange}`);
    api
      .get('/energy-usage/projections', { params: { timeRange } })
      .then(res => {
        console.log('[EnergyUsageChart] projections response:', res.data);
        setServerData(res.data);
      })
      .catch(err => {
        console.error('[EnergyUsageChart] Failed to fetch projections:', err);
        setServerData([]);
      });
  }, [timeRange]);

  // Fallback generator (unchanged)
  function generateFallback(count: number, daysPer: number, monthly = false): ChartPoint[] {
    const today = new Date();
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(today);
      if (monthly) d.setMonth(d.getMonth() + i + 1);
      else d.setDate(d.getDate() + (i + 1) * daysPer);

      const monthFactor = SEASONAL[d.getMonth()];
      const label = monthly
        ? d.toLocaleString('default', { month: 'short' })
        : d.toISOString().split('T')[0];

      let total = 0;
      const byApp: Record<string, number> = {};

      appliances.forEach(a => {
        const baseKwh =
          ((a.isHighEfficiency ? a.wattage * 0.8 : a.wattage) *
            a.hoursPerDay *
            (monthly ? d.getDate() : daysPer)) /
          1000;

        const seed = xfnv1a(`${a.id}-${label}`);
        const noise = 1 + (mulberry32(seed)() * 2 * NOISE_BOUND - NOISE_BOUND);

        const kwh = baseKwh * monthFactor * noise;
        const cost = convertCost(kwh);
        byApp[a.name] = cost;
        total += cost;
      });

      return { date: label, total, ...byApp };
    });
  }

  const dailyProj = useMemo(() => generateFallback(30, 1), [appliances, convertCost]);
  const weeklyProj = useMemo(() => generateFallback(4, 7), [appliances, convertCost]);
  const monthlyProj = useMemo(() => generateFallback(6, 30, true), [appliances, convertCost]);

  // Build chart data
  const chartData: ChartPoint[] = useMemo(() => {
    const raw = serverData.length
      ? serverData.map(pt => ({
          date: pt.date,
          total: convertCost(pt.totalCost),
          ...Object.fromEntries(
            Object.entries(pt.byAppCost).map(([k, v]) => [k, convertCost(v)])
          ),
        }))
      : timeRange === 'daily'
      ? dailyProj
      : timeRange === 'weekly'
      ? weeklyProj
      : monthlyProj;

    if (!cumulative) return raw;

    const sums: Record<string, number> = {};
    return raw.map(row => {
      const out: any = { date: row.date };
      Object.entries(row).forEach(([key, val]) => {
        if (key === 'date') return;
        sums[key] = (sums[key] || 0) + (typeof val === 'number' ? val : 0);
        out[key] = sums[key];
      });
      return out;
    });
  }, [serverData, dailyProj, weeklyProj, monthlyProj, timeRange, cumulative, convertCost]);

  // Average cost line
  const averageCost = useMemo(() => {
    if (!chartData.length) return 0;
    const key = viewMode === 'total' ? 'total' : visibleApps[0];
    const vals = chartData.map(p => (typeof p[key] === 'number' ? (p[key] as number) : 0));
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  }, [chartData, viewMode, visibleApps]);

  // Initialize per-appliance selector
  useEffect(() => {
    if (viewMode === 'perAppliance' && appliances.length) {
      setVisibleApps([appliances[0].name]);
    }
  }, [viewMode, appliances]);

  if (!appliances.length) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-offwhite-50 dark:bg-gray-800 rounded-lg">
        <p className="mb-4 text-gray-700 dark:text-offwhite-50">No appliances added.</p>
        <Link to="/add-appliance" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          <Plus className="w-5 h-5 mr-2" /> Add Appliance
        </Link>
      </div>
    );
  }

  const activeKey = viewMode === 'total' ? 'total' : visibleApps[0];
  const idx = viewMode === 'total'
    ? 0
    : appliances.findIndex(a => a.name === activeKey) + 1;
  const activeColor = COLORS[idx % COLORS.length];

  return (
    <div className="space-y-4 p-4 rounded-lg bg-white dark:bg-gray-900 shadow" style={{ height }}>
      {useEstimate && (
        <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200 px-4 py-2 rounded">
          Usage projections are based on estimated data due to limited history.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value as any)}
          className="border rounded px-2 py-1"
        >
          <option value="daily">Next 30 Days</option>
          <option value="weekly">Next 4 Weeks</option>
          <option value="monthly">Next 6 Months</option>
        </select>

        <select
          value={viewMode}
          onChange={e => setViewMode(e.target.value as any)}
          className="border rounded px-2 py-1"
        >
          <option value="total">Total Cost</option>
          <option value="perAppliance">Per Appliance</option>
        </select>

        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={cumulative}
            onChange={() => setCumulative(c => !c)}
          />
          <span>Cumulative</span>
        </label>

        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showAverage}
            onChange={() => setShowAverage(a => !a)}
          />
          <span>Show Average</span>
        </label>
      </div>

      {/* Per-appliance selector */}
      {viewMode === 'perAppliance' && (
        <div className="flex flex-wrap gap-2 mt-1 mb-1">
          {appliances.map(a => (
            <button
              key={a.id}
              onClick={() => setVisibleApps([a.name])}
              className={`px-3 py-1 rounded text-sm ${
                visibleApps[0] === a.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-700 text-black dark:text-white'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="relative w-full overflow-visible">
        <ResponsiveContainer width="100%" height={height! - 180}>
          <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 60, left: 50 }}>
            <XAxis
              dataKey="date"
              stroke="currentColor"
              tick={({ x, y, payload }) => (
                <text
                  x={x} y={y + 15}
                  textAnchor="end"
                  fill="currentColor"
                  transform={`rotate(-20, ${x}, ${y + 15})`}
                  fontSize={12}
                >
                  {payload.value}
                </text>
              )}
            />
            <YAxis
              stroke="currentColor"
              label={{
                value: `Cost (${symbol})`,
                angle: -90,
                position: 'insideLeft',
                dx: -10,
                dy: 25,
              }}
            />
            <Tooltip
              formatter={(v: number) => `${symbol}${v.toFixed(2)}`}
              contentStyle={{
                backgroundColor: settings.darkMode ? '#1f2937' : '#fff',
                borderColor: settings.darkMode ? '#374151' : '#ccc',
              }}
              itemStyle={{ color: settings.darkMode ? '#fff' : '#000' }}
              labelStyle={{ color: settings.darkMode ? '#fff' : '#000' }}
            />
            {showAverage && (
              <ReferenceLine y={averageCost} stroke="#888" strokeDasharray="3 3" />
            )}
            {viewMode === 'total'
              ? <Line type="monotone" dataKey="total" stroke={COLORS[0]} dot={false} />
              : visibleApps.map(name => (
                  <Line
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={COLORS[
                      (appliances.findIndex(a => a.name === name) + 1) % COLORS.length
                    ]}
                    dot={false}
                  />
                ))
            }
          </LineChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div
          className="absolute left-1/2 transform -translate-x-1/2 text-sm flex items-center space-x-1"
          style={{ bottom: 32 }}
        >
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: activeColor }}
          />
          <span>{activeKey === 'total' ? 'Total' : activeKey}</span>
        </div>

        {/* Average display */}
        {showAverage && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center mt-3">
            Average = {symbol}{averageCost.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
