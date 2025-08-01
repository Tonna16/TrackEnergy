// src/components/DashboardSummary.tsx
import React, { useEffect, useState } from 'react'
import EnergyUsageChart from './EnergyUsageChart'
import UsageSummary from './UsageSummary'
import api from '../utils/api'

type DashboardSummaryProps = {
  useEstimate: boolean
}

export default function DashboardSummary({ useEstimate }: DashboardSummaryProps) {
  const [avgDailyCostFromChart, setAvgDailyCostFromChart] = useState(0)
  const [forecastedDailyCost, setForecastedDailyCost] = useState<number | null>(null)

  useEffect(() => {
    api.get('energy-usage/forecasted-daily-cost')
      .then(res => {
        if (typeof res.data === 'number') {
          setForecastedDailyCost(res.data)
        } else if (res.data.forecastedDailyCost) {
          setForecastedDailyCost(res.data.forecastedDailyCost)
        }
      })
      .catch(() => {
        setForecastedDailyCost(null)
      })
  }, [])

  // Only pass backend forecast to UsageSummary
  const costToShow = forecastedDailyCost ?? avgDailyCostFromChart

  return (
    <div className="space-y-6">
      <EnergyUsageChart
        useEstimate={useEstimate}
        onAverageCostChange={setAvgDailyCostFromChart}
      />
      <UsageSummary avgDailyCostFromChart={costToShow} />
    </div>
  )
}
