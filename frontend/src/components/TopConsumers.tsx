// src/components/TopConsumers.tsx
import React, { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'

type Props = {
  topN?: number
}

export default function TopConsumers({ topN = 5 }: Props) {
  const {
    trackedAppliances,
    costFromKwh,
    formatConvertedCost,
    forecastedDailyCost,
    symbol,
  } = useAppContext()

  const rows = useMemo(() => {
    // compute per-appliance daily kWh
    const appliancesWithKwh = trackedAppliances.map(a => {
      const dailyKwh =
        typeof a.estimatedDailyKWh === 'number' && !isNaN(a.estimatedDailyKWh)
          ? a.estimatedDailyKWh
          : (a.wattage * a.hoursPerDay * (a.daysPerWeek / 7)) / 1000
      return { id: a.id, name: a.name, dailyKwh }
    })

    // sum total kWh so we can allocate forecast proportionally
    const totalKwh = appliancesWithKwh.reduce((sum, itm) => sum + itm.dailyKwh, 0)

    // compute entries
    return appliancesWithKwh
      .map(({ id, name, dailyKwh }) => {
        const directDailyCost = costFromKwh(dailyKwh) // per-appliance direct estimate (currency)
        const share = totalKwh > 0 ? dailyKwh / totalKwh : 0
        const allocatedDailyCost =
          typeof forecastedDailyCost === 'number' ? forecastedDailyCost * share : directDailyCost

        return {
          id,
          name,
          dailyKwh,
          directDailyCost,
          allocatedDailyCost,
        }
      })
      .sort((a, b) => b.allocatedDailyCost - a.allocatedDailyCost)
      .slice(0, topN)
  }, [trackedAppliances, costFromKwh, forecastedDailyCost, topN])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Top Energy Consumers</h3>
        <div className="text-sm text-gray-600 dark:text-gray-300">
         Total Forecasted Daily Cost:{' '}
          {typeof forecastedDailyCost === 'number'
            ? formatConvertedCost(forecastedDailyCost)
            : `${symbol}—`}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">No visible appliances.</p>
      ) : (
        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className="flex justify-between items-center py-2 border-b last:border-b-0">
              <div>
                <div className="font-medium">{r.name}</div>
                <div className="text-xs text-gray-500">
                  {r.dailyKwh.toFixed(2)} kWh/day
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatConvertedCost(r.allocatedDailyCost)}</div>
                <div className="text-xs text-gray-500">
                  {/* show the direct estimate as secondary text for comparison */}
                  {r.directDailyCost !== undefined && (
                    <span>est. {formatConvertedCost(r.directDailyCost)} (calc)</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
