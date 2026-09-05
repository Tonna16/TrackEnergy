// src/components/DashboardSummary.tsx
import { useState } from 'react'
import EnergyUsageChart from './EnergyUsageChart'
import UsageSummary from './UsageSummary'

type DashboardSummaryProps = {
  useEstimate: boolean
}

export default function DashboardSummary({ useEstimate }: DashboardSummaryProps) {
  const [avgDailyCostFromChart, setAvgDailyCostFromChart] = useState(0)

  return (
    <div className="space-y-6">
      <EnergyUsageChart
        useEstimate={useEstimate}
        onAverageCostChange={setAvgDailyCostFromChart}
      />
      <UsageSummary avgDailyCostFromChart={avgDailyCostFromChart} />
    </div>
  )
}
