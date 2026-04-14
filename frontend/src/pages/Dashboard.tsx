import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import ApplianceCard from '../components/ApplianceCard'
import EnergyUsageChart from '../components/EnergyUsageChart'
import UsageSummary from '../components/UsageSummary'
import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function Dashboard() {
  const { appliances, dailyUsageSeries, convertCurrency } = useAppContext()
  const navigate = useNavigate()
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'))
  const hasLimitedData = dailyUsageSeries.length < 5

  // State for average daily cost from chart
  const [avgDailyCost, setAvgDailyCost] = useState<number | null>(null)

  // Backend contract:
  // - `energy-usage/forecasted-daily-cost` returns a USD value.
  // - We must convert that USD value exactly once on the frontend via `convertCurrency`.
  // - Downstream components should treat this value as already converted for display.
  const [forecastedDailyCost, setForecastedDailyCost] = useState<number | null>(null)
  const [costAvailabilityMessage, setCostAvailabilityMessage] = useState<string | null>(null)

  const dailyCostToShow = forecastedDailyCost ?? avgDailyCost

  useEffect(() => {
    if (!isLoggedIn) {
      setForecastedDailyCost(null)
      setCostAvailabilityMessage('Unavailable')
      return
    }

    if (appliances.length === 0) {
      setForecastedDailyCost(null)
      setCostAvailabilityMessage('Insufficient data')
      return
    }

    setCostAvailabilityMessage(null)

    api.get('energy-usage/forecasted-daily-cost')
      .then(res => {
        const rawUsdCost = typeof res.data === 'number' ? res.data : res.data.forecastedDailyCost
        if (typeof rawUsdCost === 'number' && Number.isFinite(rawUsdCost)) {
          const convertedCost = convertCurrency(rawUsdCost)
          setForecastedDailyCost(convertedCost)
          setCostAvailabilityMessage(null)
        } else {
          setForecastedDailyCost(null)
          setCostAvailabilityMessage('Unavailable')
        }
      })
      .catch((err) => {
        console.error('Error fetching forecasted daily cost:', err)
        setForecastedDailyCost(null)
        setCostAvailabilityMessage('Unavailable')
      })
  }, [isLoggedIn, appliances, convertCurrency])


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
        <UsageSummary
          avgDailyCostFromChart={dailyCostToShow}
          costAvailabilityMessage={costAvailabilityMessage}
        />
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
