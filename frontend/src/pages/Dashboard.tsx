import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import ApplianceCard from '../components/ApplianceCard'
import EnergyUsageChart from '../components/EnergyUsageChart'
import UsageSummary from '../components/UsageSummary'
import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function Dashboard() {
  const { appliances, dailyUsageSeries, totalDailyUsage, convertCurrency } = useAppContext()
  const navigate = useNavigate()
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'))
  const hasLimitedData = dailyUsageSeries.length < 5

  // State for average daily cost from chart
  const [avgDailyCost, setAvgDailyCost] = useState(0)

  // State for backend forecasted stable daily cost (in user currency)
  const [forecastedDailyCost, setForecastedDailyCost] = useState<number | null>(null)

  useEffect(() => {
    if (!isLoggedIn) return
  
    if (appliances.length === 0) {
      setForecastedDailyCost(0)
      return
    }
  
    api.get('energy-usage/forecasted-daily-cost')
      .then(res => {
        let cost = typeof res.data === 'number' ? res.data : res.data.forecastedDailyCost
        if (cost != null) {
          console.log('Backend cost raw:', cost)
console.log('Backend cost converted:', convertCurrency(cost))

          const convertedCost = convertCurrency(cost)
          setForecastedDailyCost(convertedCost)
        }
      })
      .catch(() => {
        setForecastedDailyCost(null)
      })
  }, [isLoggedIn, appliances, convertCurrency])
  

  // Use backend forecast if available, otherwise fallback to chart average
  const dailyCostToShow = forecastedDailyCost ?? avgDailyCost

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => navigate('/add-appliance')}
          className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg"
        >
          <Plus className="w-5 h-5 mr-1" />
          Add Appliance
        </button>
      </div>

      <div className="card">
        <UsageSummary avgDailyCostFromChart={dailyCostToShow} />
      </div>

      <div className="card">
        <h2 className="text-lg font-medium mb-4">Energy Usage Over Time</h2>
        <EnergyUsageChart
          useEstimate={hasLimitedData}
          onAverageCostChange={setAvgDailyCost}
        />
      </div>

      <div>
        <h2 className="text-lg font-medium mb-4">Your Appliances</h2>
        {appliances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appliances.map((a) => (
              <ApplianceCard key={a.id} appliance={a} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center py-8">
            <img
              src="https://images.unsplash.com/photo-1519710164239-da123dc03ef4"
              alt="Empty state"
              className="w-64 h-48 object-cover rounded-lg mb-4"
            />
            <h3 className="text-lg font-medium">No appliances added yet</h3>
            <p className="text-gray-500 text-center max-w-md mt-2 mb-4">
              Start monitoring your energy usage by adding your first appliance.
            </p>
            <button
              onClick={() => navigate('/add-appliance')}
              className="btn btn-primary"
            >
              Add Your First Appliance
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
