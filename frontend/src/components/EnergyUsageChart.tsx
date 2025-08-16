// src/components/EnergyUsageChart.tsx
import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from 'recharts'
import { Plus } from 'lucide-react'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { useAppContext } from '../context/AppContext'
import { generateEstimate } from '../utils/energyEstimator'
import type { ChartPoint } from '../utils/energyEstimator'

interface Props {
  height?: number
  useEstimate: boolean
  onAverageCostChange?: (avgCost: number) => void
  backendForecast?: number
}
const MAX_COST = 10000

export default function EnergyUsageChart({
  height = 480,
  useEstimate,
  onAverageCostChange,
  backendForecast,
}: Props) {
  const { appliances, symbol, settings, convertCurrency, costFromKwh } = useAppContext()

  const [timeRange, setTimeRange] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [viewMode, setViewMode] = useState<'total' | 'perAppliance'>('total')
  const [cumulative, setCumulative] = useState(false)
  const [visibleApps, setVisibleApps] = useState<string[]>([])
  const [showAverage, setShowAverage] = useState(true)
  const [serverData, setServerData] = useState<
    { date: string; totalCost: number; byAppCost: Record<string, number> }[]
  >([])

  // pretty label helper (safe)
  function prettyLabel(label: string) {
    if (!label && label !== '') return ''
    const d = new Date(String(label))
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
    }
    const maybeMonthYear = /^[A-Za-z]{3,}\s*\d{4}$/.test(String(label))
    if (maybeMonthYear) return String(label)
    return String(label)
  }

  // Initialize visibleApps
  useEffect(() => {
    if (appliances.length && visibleApps.length === 0) {
      setVisibleApps([appliances[0].name])
    }
  }, [appliances, visibleApps])

  const dailyEst = useMemo(
    () => generateEstimate({ appliances, convertCost: costFromKwh, count: 30, daysPer: 1 }),
    [appliances, costFromKwh]
  )
  const weeklyEst = useMemo(
    () => generateEstimate({ appliances, convertCost: costFromKwh, count: 4, daysPer: 7 }),
    [appliances, costFromKwh]
  )
  const monthlyEst = useMemo(
    () =>
      generateEstimate({
        appliances,
        convertCost: costFromKwh,
        count: 6,
        daysPer: 30,
        monthly: true,
      }),
    [appliances, costFromKwh]
  )

  useEffect(() => {
    const token = getAuthToken();
    const isLoggedIn = Boolean(token);
  
    if (!isLoggedIn) {
      // Guest / simulated mode → do not call backend
      if (import.meta.env.MODE === 'development') {
        console.log('Guest detected, using client-side fallback estimates only.');
      }
      setServerData([]); // triggers generateEstimate in chartData
      return; // exit early
    }
  
    let cancelled = false;
  
    const fetchProjections = async () => {
      try {
        const res = await api.get('energy-usage/projections', { params: { timeRange } });
  
        if (cancelled) return;
  
        if (Array.isArray(res.data)) {
          setServerData(res.data);
        } else if (res.data && Array.isArray(res.data.projections)) {
          setServerData(res.data.projections);
        } else {
          setServerData([]);
        }
      } catch (err: unknown) {
        if (cancelled) return;
  
        let errorMsg: string;
  
        if (err instanceof Error) {
          errorMsg = err.message;
        } else if (
          typeof err === 'object' &&
          err !== null &&
          'response' in err &&
          (err as any).response
        ) {
          errorMsg = (err as any).response?.data ?? 'Unknown server error';
        } else {
          errorMsg = String(err);
        }
  
        console.error('Error fetching authenticated projections:', errorMsg);
        setServerData([]);
      }
    };
  
    fetchProjections();
  
    return () => {
      cancelled = true;
    };
  }, [timeRange, appliances]);
  



  const chartData: ChartPoint[] = useMemo(() => {
    const hasServer = serverData.some(d => d.totalCost > 0)

    const raw: ChartPoint[] = hasServer
      ? serverData.map(d => {
          const totalCostConverted = convertCurrency(d.totalCost)
          const byAppCosts = Object.fromEntries(
            Object.entries(d.byAppCost).map(([name, cost]) => [name, Math.min(convertCurrency(cost), MAX_COST)])
          )
          return { date: d.date, total: Math.min(totalCostConverted, MAX_COST), ...byAppCosts }
        })
      : timeRange === 'daily'
      ? dailyEst
      : timeRange === 'weekly'
      ? weeklyEst
      : monthlyEst

    if (!cumulative) return raw

    const sums: Record<string, number> = {}
    return raw.map(row => {
      const out: any = { date: row.date }
      for (const [key, val] of Object.entries(row)) {
        if (key === 'date') continue
        const value = typeof val === 'number' ? val : 0
        sums[key] = (sums[key] || 0) + value
        out[key] = sums[key]
      }
      return out
    })
  }, [serverData, dailyEst, weeklyEst, monthlyEst, timeRange, cumulative, convertCurrency])

  // Average cost calculation
  const averageCost = useMemo(() => {
    const key = viewMode === 'total' ? 'total' : visibleApps[0] || 'total'
    const values = chartData.map(row => row[key]).filter(v => typeof v === 'number') as number[]
    if (!values.length) return 0
    return values.reduce((s, v) => s + v, 0) / values.length
  }, [chartData, viewMode, visibleApps])

  useEffect(() => {
    if (!onAverageCostChange) return
    if (backendForecast !== undefined) onAverageCostChange(backendForecast)
    else onAverageCostChange(averageCost)
  }, [backendForecast, averageCost, onAverageCostChange])

  if (!appliances.length) {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-offwhite-50 dark:bg-gray-800 rounded-lg">
        <p className="mb-4 text-gray-700 dark:text-offwhite-50">No appliances added.</p>
        <Link to="/add-appliance" className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700">
          <Plus className="w-5 h-5 mr-2" /> Add Appliance
        </Link>
      </div>
    )
  }

  const activeKey = viewMode === 'total' ? 'total' : visibleApps[0]
  const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ef4444', '#3b82f6', '#14b8a6', '#8b5cf6']
  const colorIndex = viewMode === 'total' ? 0 : appliances.findIndex(a => a.name === activeKey) + 1
  const activeColor = COLORS[colorIndex % COLORS.length]

  return (
    <div className="space-y-4 p-4 rounded-lg bg-white dark:bg-gray-900 shadow" style={{ height }}>
      {useEstimate && (
        <div className="bg-yellow-100 text-yellow-800 dark:bg-yellow-700 dark:text-yellow-200 px-4 py-2 rounded">
          Usage projections are based on estimated data due to limited history.
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center mb-2">
        <select value={timeRange} onChange={e => setTimeRange(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="daily">Next 30 Days</option>
          <option value="weekly">Next 4 Weeks</option>
          <option value="monthly">Next 6 Months</option>
        </select>

        <select value={viewMode} onChange={e => setViewMode(e.target.value as any)} className="border rounded px-2 py-1">
          <option value="total">Total Cost</option>
          <option value="perAppliance">Per Appliance</option>
        </select>

        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={cumulative} onChange={() => setCumulative(c => !c)} />
          <span>Cumulative</span>
        </label>

        <label className="inline-flex items-center space-x-2">
          <input type="checkbox" checked={showAverage} onChange={() => setShowAverage(a => !a)} />
          <span>Show Average</span>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={height - 180}>
        <LineChart data={chartData} margin={{ top: 20, right: 30, bottom: 60, left: 50 }}>
          <XAxis
            dataKey="date"
            stroke="currentColor"
            tick={({ x, y, payload }) => (
              <text x={x} y={y + 15} textAnchor="end" fill="currentColor" transform={`rotate(-20,${x},${y + 15})`} fontSize={12}>
                {payload.value}
              </text>
            )}
          />

          <YAxis
            stroke="currentColor"
            domain={[0, (dataMax: number) => Math.ceil(dataMax / 0.05) * 0.05]}
            tickFormatter={v => v.toFixed(2)}
            label={{ value: `Cost (${symbol})`, angle: -90, position: 'insideLeft', dx: -10, dy: 25 }}
          />

          <Tooltip
            formatter={(v: number) => `${symbol}${v.toFixed(2)}`}
            labelFormatter={label => prettyLabel(String(label))}
            contentStyle={{ backgroundColor: settings.darkMode ? '#1f2937' : '#fff', borderColor: settings.darkMode ? '#374151' : '#ccc' }}
            itemStyle={{ color: settings.darkMode ? '#fff' : '#000' }}
            labelStyle={{ color: settings.darkMode ? '#fff' : '#000' }}
          />

          {showAverage && <ReferenceLine y={averageCost} stroke="#888" strokeDasharray="3 3" />}

          {viewMode === 'total' ? (
            <Line type="monotone" dataKey="total" stroke={COLORS[0]} dot={false} />
          ) : (
            visibleApps.map(name => {
              const idx = appliances.findIndex(a => a.name === name)
              const color = idx >= 0 ? COLORS[(idx + 1) % COLORS.length] : '#999'
              return <Line key={name} type="monotone" dataKey={name} stroke={color} dot={false} />
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
  )
}
