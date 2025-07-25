// src/components/ApplianceCard.tsx
import { Trash, Edit, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAppContext, Appliance } from '../context/AppContext'

interface ApplianceCardProps {
  appliance: Appliance
}

export default function ApplianceCard({ appliance }: ApplianceCardProps) {
  const { deleteAppliance, costFromKwh, formatCost, symbol } = useAppContext()

  // Compute daily kWh usage
  const dailyKwh =
    (appliance.wattage * appliance.hoursPerDay * appliance.daysPerWeek) /
    7 /
    1000

  // Compute cost in current currency
  const dailyCost = costFromKwh(dailyKwh)
  const monthlyCost = dailyCost * 30

  // Efficiency badge styling
  const efficiencyClass = appliance.isHighEfficiency
    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'

  return (
    <div className="card hover:shadow-md transition-shadow dark:bg-black dark:border-dark-border">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold">{appliance.name}</h3>
          <p className="text-sm text-gray-500 dark:text-emerald-400">
            {appliance.brand && appliance.model
              ? `${appliance.brand} ${appliance.model}`
              : appliance.type}
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-dark-input dark:text-dark-text">
              {appliance.location}
            </span>
            <span
              className={`px-2 py-0.5 text-xs rounded-full ${efficiencyClass}`}
            >
              {appliance.isHighEfficiency ? 'Energy Efficient' : 'Standard'}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end space-y-1">
          <Link
            to={`/edit-appliance/${appliance.id}`}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-emerald-500 dark:hover:text-emerald-400"
            aria-label="Edit appliance"
          >
            <Edit className="h-5 w-5" />
          </Link>
          <button
            onClick={() => deleteAppliance(appliance.id)}
            className="p-1 text-gray-500 hover:text-red-600 dark:text-emerald-500 dark:hover:text-red-400"
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
            <p className="font-medium">{dailyKwh.toFixed(2)} kWh/day</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              {formatCost(dailyCost * 30)}/mo
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
