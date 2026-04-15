import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import ApplianceCard from '../components/ApplianceCard'
import EnergyUsageChart from '../components/EnergyUsageChart'
import UsageSummary from '../components/UsageSummary'
import { useEffect, useState } from 'react'
import api from '../utils/api'

export default function Dashboard() {
  const {
    appliances,
    trackedAppliances,
    activeApplianceCount,
    inactiveApplianceCount,
    dailyUsageSeries,
    convertCurrency,
  } = useAppContext()
  const navigate = useNavigate()
  const isLoggedIn = Boolean(localStorage.getItem('accessToken'))
  const hasLimitedData = dailyUsageSeries.length < 5
  const [showInactive, setShowInactive] = useState(false)

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

    if (trackedAppliances.length === 0) {
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
  }, [isLoggedIn, trackedAppliances, convertCurrency])

  const applianceCards = showInactive ? appliances : trackedAppliances


  return (
    <div className="space-y-6 pb-16 sm:pb-0 fade-in-up">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={() => navigate('/add-appliance')}
          className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-4 py-2 text-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:bg-emerald-700 hover:shadow"
        >
          <Plus className="w-5 h-5 mr-1" />
          Add Appliance
        </button>
      </div>

      <div className="card surface-glass">
        <UsageSummary
          avgDailyCostFromChart={dailyCostToShow}
          costAvailabilityMessage={costAvailabilityMessage}
        />
      </div>

      <div className="card surface-glass card-interactive">
        <h2 className="text-lg font-medium mb-4">Energy Usage Over Time</h2>
        <EnergyUsageChart
          useEstimate={hasLimitedData}
          onAverageCostChange={setAvgDailyCost}
        />
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Your Appliances</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Tracking {activeApplianceCount} active appliance{activeApplianceCount === 1 ? '' : 's'}
            </span>
            {inactiveApplianceCount > 0 && (
              <label className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={e => setShowInactive(e.target.checked)}
                />
                Show inactive ({inactiveApplianceCount})
              </label>
            )}
          </div>
        </div>
        {applianceCards.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {applianceCards.map((a) => (
              <ApplianceCard key={a.id} appliance={a} />
            ))}
          </div>
        ) : (
          <div className="card surface-glass flex flex-col items-center py-8 fade-in-up">
            <img
              src="https://images.unsplash.com/photo-1519710164239-da123dc03ef4"
              alt="Empty state"
              className="w-64 h-48 object-cover rounded-lg mb-4"
            />
            <h3 className="text-lg font-medium">
              {appliances.length > 0 ? 'No active appliances are being tracked' : 'No appliances added yet'}
            </h3>
            <p className="text-gray-500 text-center max-w-md mt-2 mb-4">
              {appliances.length > 0
                ? 'Activate an appliance or enable “Show inactive” to review your full list.'
                : 'Start monitoring your energy usage by adding your first appliance.'}
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
