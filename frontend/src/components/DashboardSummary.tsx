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
  const costToShow = forecastedDailyCost ?? avgDailyCostFromChart


  
  useEffect(() => {
    console.log('DashboardSummary mounted, fetching forecasted daily cost')
    api.get('energy-usage/forecasted-daily-cost')
      .then(res => {
        const cost = typeof res.data === 'number' ? res.data : res.data.forecastedDailyCost
        console.log('DashboardSummary backend cost:', cost)
        setForecastedDailyCost(cost)
      })
      .catch((err) => {
        console.error('DashboardSummary fetch error:', err)
        setForecastedDailyCost(null)
      })
  }, [])
  
  console.log('DashboardSummary rendering, costToShow:', costToShow)
  

  // Only pass backend forecast to UsageSummary

  return (
    <div className="space-y-6">
     <EnergyUsageChart
  useEstimate={useEstimate}
  onAverageCostChange={setAvgDailyCostFromChart}
  backendForecast={forecastedDailyCost ?? undefined} // ✅ pass this down
/>

      <UsageSummary avgDailyCostFromChart={costToShow} />
    </div>
  )
}
