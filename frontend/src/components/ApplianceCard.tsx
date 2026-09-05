// src/components/ApplianceCard.tsx
import { Trash, Edit, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppContext, Appliance } from '../context/AppContext'
import { getKwhPerDay, getKwhPerMonth } from '../utils/energyCalculations'
interface ApplianceCardProps {
  appliance: Appliance
}

export default function ApplianceCard({ appliance }: ApplianceCardProps) {
  const { deleteAppliance, costFromKwh, formatCost, setApplianceActive } = useAppContext()
  
  // Compute daily kWh usage
  const dailyKwh = getKwhPerDay(appliance)

  // Compute cost in current currency
  const monthlyCost = costFromKwh(getKwhPerMonth(appliance))

  // Efficiency badge styling
  const efficiencyClass = appliance.isHighEfficiency
    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'

  return (
    <div
      className={`card card-interactive fade-in-up dark:bg-black dark:border-dark-border ${
        appliance.active === false ? 'opacity-60' : ''
      }`}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold">{appliance.name}</h3>
          <p className="text-sm text-gray-500 dark:text-emerald-400">
            {appliance.brand && appliance.model
              ? `${appliance.brand} ${appliance.model}`
              : appliance.type}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {appliance.isSample && (
              <span className="px-2 py-0.5 text-xs rounded-full bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                Sample data
              </span>
            )}
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-dark-input dark:text-dark-text">
              {appliance.location}
            </span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${efficiencyClass}`}
            >
              {appliance.isHighEfficiency ? 'High-efficiency (info)' : 'Standard'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <Link
            to={`/edit-appliance/${appliance.id}`}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-emerald-500 dark:hover:bg-dark-input dark:hover:text-emerald-400"
            aria-label="Edit appliance"
          >
            <Edit className="h-5 w-5" />
          </Link>
          <button
            onClick={() => setApplianceActive(appliance.id, appliance.active === false)}
            className="text-xs px-2 py-1 rounded-md border border-gray-300 text-gray-600 transition-colors hover:bg-gray-100 dark:border-dark-border dark:text-dark-text dark:hover:bg-dark-input"
            aria-label={appliance.active === false ? 'Set appliance active' : 'Set appliance inactive'}
          >
            {appliance.active === false ? 'Inactive' : 'Active'}
          </button>
          <button
            onClick={() => deleteAppliance(appliance.id)}
            className="rounded-md p-1 text-gray-500 transition-colors hover:bg-red-50 hover:text-red-600 dark:text-emerald-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            aria-label="Delete appliance"
          >
            <Trash className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t dark:border-dark-border">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center text-gray-700 dark:text-dark-text">
            <Zap className="h-5 w-5 text-amber-500 mr-1.5" />
            <span>
              {appliance.wattage} W • {appliance.hoursPerDay} hrs/day
            </span>
          </div>
          <div className="text-right">
            <p className="font-medium">{dailyKwh.toFixed(2)} kWh/day Formula Estimate</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {formatCost(monthlyCost)}/mo
            </p>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {appliance.estimatedDailyKWh !== null && appliance.estimatedDailyKWh !== undefined
            ? `Manual daily kWh override applied: ${appliance.estimatedDailyKWh.toFixed(2)} kWh/day.`
            : `${appliance.daysPerWeek} day${appliance.daysPerWeek === 1 ? '' : 's'}/week included.`}
          {appliance.active === false && ' Excluded from household totals while inactive.'}
        </div>
      </div>
    </div>
  )
}
