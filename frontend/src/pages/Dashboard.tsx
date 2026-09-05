import { useNavigate } from 'react-router-dom'
import { Plus, Zap } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import ApplianceCard from '../components/ApplianceCard'
import EnergyUsageChart from '../components/EnergyUsageChart'
import UsageSummary from '../components/UsageSummary'
import UsageReportDownloads from '../components/UsageReportDownloads'
import { useState } from 'react'

export default function Dashboard() {
  const {
    appliances,
    trackedAppliances,
    activeApplianceCount,
    inactiveApplianceCount,
    hasSampleData,
    demoMode,
    loadSampleHome,
    removeSampleData,
    resetDemoData,
    totalDailyCost,
  } = useAppContext()
  const navigate = useNavigate()
  const [showInactive, setShowInactive] = useState(false)

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

      {demoMode && <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>
            {hasSampleData
              ? 'Local Demo includes a clearly labeled sample home and deterministic sample history. Nothing is sent to a server.'
              : 'Local Demo stores appliances, settings, and usage history only in this browser.'}
          </p>
          <div className="flex shrink-0 flex-wrap gap-2">
            <button className="btn btn-outline" onClick={loadSampleHome}>Load Sample Home</button>
            {hasSampleData && <button className="btn btn-outline" onClick={removeSampleData}>Remove Sample Data</button>}
            <button className="btn btn-outline" onClick={resetDemoData}>Reset Demo Data</button>
          </div>
        </div>
      </div>}

      <div className="card surface-glass">
        <UsageSummary
          avgDailyCostFromChart={totalDailyCost}
        />
      </div>

      <UsageReportDownloads />

      <div className="card surface-glass card-interactive">
        <h2 className="text-lg font-medium mb-4">Future Energy Cost</h2>
        <EnergyUsageChart
          useEstimate
        />
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-medium">Your Appliances</h2>
          <div className="flex items-center gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
              Included: {activeApplianceCount} active appliance{activeApplianceCount === 1 ? '' : 's'}
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
            <Zap aria-hidden="true" className="mb-4 h-16 w-16 text-emerald-500" />
            <h3 className="text-lg font-medium">
              {appliances.length > 0 ? 'No active appliances are included' : 'No appliances added yet'}
            </h3>
            <p className="text-gray-500 text-center max-w-md mt-2 mb-4">
              {appliances.length > 0
                ? 'Activate an appliance or enable “Show inactive” to review your full list.'
                : 'Start estimating your energy usage by adding your first appliance.'}
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
