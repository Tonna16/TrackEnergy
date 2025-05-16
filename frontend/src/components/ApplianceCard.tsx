import  { Trash, Edit, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Appliance, useAppContext } from '../context/AppContext';

interface ApplianceCardProps {
  appliance: Appliance;
}

export default function ApplianceCard({ appliance }: ApplianceCardProps) {
  const { deleteAppliance, settings } = useAppContext();
  
  const dailyUsage = (appliance.wattage * appliance.hoursPerDay * appliance.daysPerWeek / 7) / 1000;
  const dailyCost = dailyUsage * settings.electricityRate;
  const monthlyCost = dailyCost * 30;
  
  const efficiencyClass = appliance.isHighEfficiency
    ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400';
  
  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold">{appliance.name}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {appliance.brand && appliance.model ? `${appliance.brand} ${appliance.model}` : appliance.type}
          </p>
          <div className="flex space-x-2 mt-2">
            <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {appliance.location}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${efficiencyClass}`}>
              {appliance.isHighEfficiency ? 'Energy Efficient' : 'Standard'}
            </span>
          </div>
        </div>
        <div className="flex">
          <Link
            to={`/edit-appliance/${appliance.id}`}
            className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <Edit className="h-5 w-5" />
          </Link>
          <button
            onClick={() => deleteAppliance(appliance.id)}
            className="p-1 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
          >
            <Trash className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      <div className="mt-4 pt-4 border-t dark:border-gray-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center text-gray-700 dark:text-gray-300">
            <Zap className="h-5 w-5 text-amber-500 mr-1.5" />
            <span>{appliance.wattage} W • {appliance.hoursPerDay} hrs/day</span>
          </div>
          <div className="text-right">
            <p className="font-medium">{dailyUsage.toFixed(2)} kWh/day</p>
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              ~{settings.currency === 'USD' ? '$' : '€'}{monthlyCost.toFixed(2)}/mo
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
 