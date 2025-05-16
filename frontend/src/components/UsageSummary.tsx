import { Activity, DollarSign, AlertTriangle, TrendingDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import EnergyTip from './EnergyTip';

export default function UsageSummary() {
  const { totalDailyUsage, totalDailyCost, settings } = useAppContext();

  const monthlyUsage = totalDailyUsage * 30;
  const monthlyCost = totalDailyCost * 30;
  const avgDailyUsage = settings.householdSize < 5 
    ? 30 / settings.householdSize 
    : 6;

  const usageComparison = ((totalDailyUsage - avgDailyUsage) / avgDailyUsage) * 100;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Total Energy Usage */}
      <div className="card flex items-start space-x-4">
        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
          <Activity className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Daily Usage</p>
          <h4 className="text-xl font-semibold">
            {totalDailyUsage.toFixed(2)} kWh
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ~{monthlyUsage.toFixed(0)} kWh/mo
          </p>
        </div>
      </div>
      
      {/* Cost Estimate */}
      <div className="card flex items-start space-x-4">
        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20">
          <DollarSign className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Daily Cost</p>
          <h4 className="text-xl font-semibold">
            {settings.currency === 'USD' ? '$' : '€'}{totalDailyCost.toFixed(2)}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            ~{settings.currency === 'USD' ? '$' : '€'}{monthlyCost.toFixed(2)}/mo
          </p>
        </div>
      </div>
      
      {/* Comparison */}
      <div className="card flex items-start space-x-4">
        <div className={`p-2 rounded-lg ${
          usageComparison > 0 
            ? 'bg-amber-50 dark:bg-amber-900/20' 
            : 'bg-green-50 dark:bg-green-900/20'
        }`}>
          <AlertTriangle className={`h-6 w-6 ${
            usageComparison > 0 
              ? 'text-amber-600 dark:text-amber-400' 
              : 'text-green-600 dark:text-green-400'
          }`} />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Vs. Average Home</p>
          <h4 className={`text-xl font-semibold ${
            usageComparison > 0 
              ? 'text-amber-600 dark:text-amber-400' 
              : 'text-green-600 dark:text-green-400'
          }`}>
            {Math.abs(usageComparison).toFixed(0)}% {usageComparison > 0 ? 'Higher' : 'Lower'}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            For {settings.householdSize} person household
          </p>
        </div>
      </div>
      
      {/* Energy Saving Tip */}
      <div className="card flex items-start space-x-4">
        <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20">
          <TrendingDown className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Energy Saving Tip</p>
          <p className="text-sm font-medium">
            <EnergyTip />
          </p>
        </div>
      </div>
    </div>
  );
}
