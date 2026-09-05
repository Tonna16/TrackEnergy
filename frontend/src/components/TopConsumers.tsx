// src/components/TopConsumers.tsx
import { useMemo } from 'react'
import { useAppContext } from '../context/AppContext'
import { getKwhPerDay } from '../utils/energyEstimator'

type Props = {
  topN?: number
}

export default function TopConsumers({ topN = 5 }: Props) {
  const {
    trackedAppliances,
    costFromKwh,
    formatCost,
    totalDailyCost,
  } = useAppContext()

  const rows = useMemo(() => {
    const appliancesWithKwh = trackedAppliances.map(a => {
      const dailyKwh = getKwhPerDay(a)
      return { id: a.id, name: a.name, dailyKwh }
    })
    return appliancesWithKwh
      .map(({ id, name, dailyKwh }) => {
        return {
          id,
          name,
          dailyKwh,
          directDailyCost: costFromKwh(dailyKwh),
        }
      })
      .sort((a, b) => b.directDailyCost - a.directDailyCost)
      .slice(0, topN)
  }, [trackedAppliances, costFromKwh, topN])

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Estimated Top Energy Consumers</h3>
        <div className="text-sm text-gray-600 dark:text-gray-300">
          Total Formula Estimate: {formatCost(totalDailyCost)}/day
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
                <div className="font-semibold">{formatCost(r.directDailyCost)}/day</div>
                <div className="text-xs text-gray-500">Formula Estimate</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
