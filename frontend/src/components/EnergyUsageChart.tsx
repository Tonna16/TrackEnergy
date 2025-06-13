// src/components/EnergyUsageChart.tsx
import { useState, useEffect, useMemo } from 'react';
import { jwtDecode } from 'jwt-decode';
import { Link } from 'react-router-dom';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { useAppContext } from '../context/AppContext';
import type { Appliance } from '../context/AppContext';
import { Plus } from 'lucide-react';

const COLORS = [
  '#10b981', '#6366f1', '#f59e0b', '#ef4444',
  '#3b82f6', '#8b5cf6', '#14b8a6', '#f43f5e',
];

const seasonalFactors: Record<number, number> = {
  0: 0.9, 1: 0.9, 2: 1, 3: 1, 4: 1.1, 5: 1.2,
  6: 1.2, 7: 1.2, 8: 1.1, 9: 1, 10: 1, 11: 0.95,
};

function getUserIdFromToken(): number | null {
  const token = localStorage.getItem('jwt');
  if (!token) return null;
  try {
    const decoded: any = jwtDecode(token);
    return parseInt(decoded.sub, 10);
  } catch {
    return null;
  }
}

interface EnergyUsageChartProps {
  height?: number;
  useEstimate: boolean;
}

export default function EnergyUsageChart({
  height = 300,
  useEstimate,
}: EnergyUsageChartProps) {
  const { appliances, settings } = useAppContext();
  const rate = settings.electricityRate;
  const symbol = settings.currency === 'USD' ? '$' : '€';

  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [viewMode, setViewMode] = useState<'perAppliance' | 'total'>('total');
  const [cumulative, setCumulative] = useState(false);
  const [visibleApps, setVisibleApps] = useState<string[]>([]);
  const [showAverage, setShowAverage] = useState(true);

  const [serverData, setServerData] = useState<
    { date: string; totalCost: number; byAppCost: Record<string, number> }[]
  >([]);

  useEffect(() => {
    const userId = getUserIdFromToken();
    if (!userId) return;
    fetch(
      `http://localhost:8080/api/energy-usage/projections?timeRange=${timeRange}`,
      { headers: { Authorization: `Bearer ${localStorage.getItem('jwt')}` } }
    )
      .then(res => {
        if (!res.ok) throw new Error('Fetch failed');
        return res.json();
      })
      .then(data => setServerData(data))
      .catch(() => setServerData([]));
  }, [timeRange]);

  const dailyProj = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + i + 1);
      const factor = seasonalFactors[d.getMonth()];
      let total = 0;
      const byApp: Record<string, number> = {};
      appliances.forEach(a => {
        const base =
          ((a.isHighEfficiency ? a.wattage * 0.8 : a.wattage) * a.hoursPerDay) / 1000;
        const noise = 1 + (Math.random() * 0.2 - 0.1);
        const kWh = base * factor * noise;
        byApp[a.name] = kWh;
        total += kWh;
      });
      return { date: d.toISOString().split('T')[0], total, byApp };
    });
  }, [appliances]);

  const weeklyProj = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 4 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() + (i + 1) * 7);
      const factor = seasonalFactors[d.getMonth()];
      let total = 0;
      const byApp: Record<string, number> = {};
      appliances.forEach(a => {
        const base =
          ((a.isHighEfficiency ? a.wattage * 0.8 : a.wattage) *
            a.hoursPerDay *
            7) /
          1000;
        const noise = 1 + (Math.random() * 0.2 - 0.1);
        const kWh = base * factor * noise;
        byApp[a.name] = kWh;
        total += kWh;
      });
      return { date: d.toISOString().split('T')[0], total, byApp };
    });
  }, [appliances]);

  const monthlyProj = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(today);
      d.setMonth(d.getMonth() + i + 1);
      const factor = seasonalFactors[d.getMonth()];
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      let total = 0;
      const byApp: Record<string, number> = {};
      appliances.forEach(a => {
        const base =
          ((a.isHighEfficiency ? a.wattage * 0.8 : a.wattage) *
            a.hoursPerDay *
            days) /
          1000;
        const noise = 1 + (Math.random() * 0.2 - 0.1);
        const kWh = base * factor * noise;
        byApp[a.name] = kWh;
        total += kWh;
      });
      return {
        date: d.toLocaleString('default', { month: 'short' }),
        total,
        byApp,
      };
    });
  }, [appliances]);

  const chartData = useMemo(() => {
    const src = serverData.length
      ? serverData.map(pt => ({
          date: pt.date,
          total: pt.totalCost * rate,
          ...Object.fromEntries(
            Object.entries(pt.byAppCost).map(([k, v]) => [k, v * rate])
          ),
        }))
      : (
          timeRange === 'daily'
            ? dailyProj
            : timeRange === 'weekly'
            ? weeklyProj
            : monthlyProj
        ).map(pt => {
          const rec: any = { date: pt.date, total: pt.total * rate };
          Object.entries(pt.byApp).forEach(([k, v]) => {
            rec[k] = v * rate;
          });
          return rec;
        });

    if (!cumulative) return src;

    let sumTotal = 0;
    const cumulativeData: any[] = [];

    src.forEach((pt, i) => {
      const newPoint: any = { date: pt.date };
      sumTotal += pt.total;
      newPoint.total = sumTotal;

      appliances.forEach(a => {
        const name = a.name;
        if (i === 0) {
          newPoint[name] = pt[name] || 0;
        } else {
          const prev = cumulativeData[i - 1]?.[name] || 0;
          newPoint[name] = prev + (pt[name] || 0);
        }
      });

      cumulativeData.push(newPoint);
    });

    return cumulativeData;
  }, [
    serverData,
    dailyProj,
    weeklyProj,
    monthlyProj,
    timeRange,
    cumulative,
    appliances,
    rate,
  ]);

  const averageCost = useMemo(() => {
    if (!chartData.length) return 0;
    if (viewMode === 'total') {
      return chartData.reduce((s, p) => s + p.total, 0) / chartData.length;
    }
    const name = visibleApps[0];
    return chartData.reduce((s, p) => s + (p[name] || 0), 0) / chartData.length;
  }, [chartData, viewMode, visibleApps]);

  useEffect(() => {
    if (viewMode === 'perAppliance') {
      setVisibleApps(appliances.length ? [appliances[0].name] : []);
    }
  }, [viewMode, appliances]);

  const selectApp = (name: string) => setVisibleApps([name]);

  if (!appliances.length) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-offwhite-50 dark:bg-gray-800 rounded-lg">
        <p className="mb-4 text-gray-700 dark:text-offwhite-50">
          No appliances added.
        </p>
        <Link
          to="/add-appliance"
          className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Plus className="w-5 h-5 mr-2" /> Add Appliance
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 overflow-hidden" style={{ height }}>
      {useEstimate && (
        <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200 px-4 py-2 rounded">
          Usage projections are based on estimated data due to limited history.
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-2">
        <select
          value={timeRange}
          onChange={e => setTimeRange(e.target.value as any)}
          className="border rounded p-1"
        >
          <option value="daily">Next 30 Days</option>
          <option value="weekly">Next 4 Weeks</option>
          <option value="monthly">Next 6 Months</option>
        </select>
        <select
          value={viewMode}
          onChange={e => setViewMode(e.target.value as any)}
          className="border rounded p-1"
        >
          <option value="total">Total Cost</option>
          <option value="perAppliance">Per Appliance</option>
        </select>
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={cumulative}
            onChange={() => setCumulative(c => !c)}
          />{' '}
          <span>Cumulative</span>
        </label>
        <label className="inline-flex items-center space-x-2">
          <input
            type="checkbox"
            checked={showAverage}
            onChange={() => setShowAverage(a => !a)}
          />{' '}
          <span>Show Average</span>
        </label>
      </div>

      {viewMode === 'perAppliance' && (
        <div className="flex flex-wrap gap-2">
          {appliances.map(a => (
            <button
              key={a.id}
              onClick={() => selectApp(a.name)}
              className={`px-3 py-1 rounded ${
                visibleApps[0] === a.name
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-300 dark:bg-gray-600 text-black dark:text-white'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Graph */}
      <div className="relative w-full overflow-hidden">
        <ResponsiveContainer width="100%" height={height - 80}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" stroke="currentColor" />
            <YAxis
              stroke="currentColor"
              label={{
                value: `Cost (${symbol})`,
                angle: -90,
                position: 'insideLeft',
                dx: -4,
                dy: 40,
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
            <Legend />
            {showAverage && (
              <ReferenceLine y={averageCost} stroke="#888" strokeDasharray="3 3" />
            )}
            {viewMode === 'total' ? (
              <Line type="monotone" dataKey="total" stroke={COLORS[0]} dot={false} />
            ) : (
              visibleApps.map((name, i) => (
                <Line
                  key={name}
                  type="monotone"
                  dataKey={name}
                  stroke={COLORS[(i + 1) % COLORS.length]}
                  dot={false}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>

        {showAverage && (
          <div className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
            Average = {symbol}
            {averageCost.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
