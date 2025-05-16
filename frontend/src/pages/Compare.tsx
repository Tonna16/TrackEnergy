import  { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import EnergyUsageChart from '../components/EnergyUsageChart';
import { nationalAverages } from '../data/applianceDatabase';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

export default function Compare() {
  const { totalDailyUsage, appliances, settings } = useAppContext();
  const [compareWith, setCompareWith] = useState<'national' | 'household' | 'similar'>('national');
  
  const monthlyUsage = totalDailyUsage * 30;
  const nationalAvg = nationalAverages.daily;
  const householdAvg = nationalAverages.by_household_size[settings.householdSize as keyof typeof nationalAverages.by_household_size] || nationalAverages.by_household_size[5];
  
  // Calculate user vs average percentage
  const calculatePercentage = (userValue: number, avgValue: number) => {
    return ((userValue - avgValue) / avgValue) * 100;
  };
  
  const nationalPercentage = calculatePercentage(totalDailyUsage, nationalAvg);
  const householdPercentage = calculatePercentage(totalDailyUsage, householdAvg);
  
  // Prepare comparison data for chart
  const applianceComparisons = appliances.map(appliance => {
    const applianceType = appliance.type;
    const userDailyUsage = (appliance.wattage * appliance.hoursPerDay * appliance.daysPerWeek / 7) / 1000;
    const avgDailyUsage = nationalAverages.by_appliance[applianceType as keyof typeof nationalAverages.by_appliance] || 1;
    const percentage = calculatePercentage(userDailyUsage, avgDailyUsage);
    
    return {
      name: appliance.name,
      userUsage: userDailyUsage,
      avgUsage: avgDailyUsage,
      percentage
    };
  }).sort((a, b) => b.percentage - a.percentage);
  
  // Helper function for comparison indicator
  const getComparisonIndicator = (percentage: number) => {
    if (percentage > 10) {
      return <ArrowUpRight className="h-5 w-5 text-red-500" />;
    } else if (percentage < -10) {
      return <ArrowDownRight className="h-5 w-5 text-green-500" />;
    } else {
      return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };
  
  // Sample data for community comparison
  const communityData = [
    { name: 'Your Usage', value: totalDailyUsage },
    { name: 'Energy Savers', value: householdAvg * 0.7 },
    { name: 'Average Users', value: householdAvg },
    { name: 'High Users', value: householdAvg * 1.3 }
  ];
  
  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Usage Comparison</h1>
      
      {/* Comparison Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setCompareWith('national')}
          className={`py-2 px-4 text-sm font-medium ${
            compareWith === 'national'
              ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          National Average
        </button>
        <button
          onClick={() => setCompareWith('household')}
          className={`py-2 px-4 text-sm font-medium ${
            compareWith === 'household'
              ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Similar Households
        </button>
        <button
          onClick={() => setCompareWith('similar')}
          className={`py-2 px-4 text-sm font-medium ${
            compareWith === 'similar'
              ? 'border-b-2 border-emerald-500 text-emerald-600 dark:text-emerald-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Community Groups
        </button>
      </div>
      
      {/* Overall Comparison */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">
          {compareWith === 'national' ? 'National Average Comparison' : 
           compareWith === 'household' ? `Comparison with ${settings.householdSize}-Person Households` :
           'Community Comparison'}
        </h2>
        
        {compareWith === 'similar' ? (
          <>
            <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg mb-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div>
                  <h3 className="font-medium">Your Community Standing</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Based on similar households in your area
                  </p>
                </div>
                <div className="mt-2 sm:mt-0 px-3 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 text-sm font-medium">
                  Top 40% of users
                </div>
              </div>
            </div>
            
            <div className="flex flex-wrap">
              {communityData.map((item, i) => (
                <div key={i} className={`w-full md:w-1/4 p-2 ${
                  item.name === 'Your Usage' ? 'order-first md:order-none' : ''
                }`}>
                  <div className={`p-4 rounded-lg ${
                    item.name === 'Your Usage' 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' 
                      : 'bg-gray-50 dark:bg-gray-800'
                  }`}>
                    <h3 className={`font-medium ${
                      item.name === 'Your Usage' ? 'text-emerald-600 dark:text-emerald-400' : ''
                    }`}>{item.name}</h3>
                    <p className="text-2xl font-semibold mt-1">{item.value.toFixed(1)} kWh</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">per day</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-8">
              <div className="w-full sm:w-1/2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">Your Daily Usage</h3>
                    <p className="text-2xl font-semibold">{totalDailyUsage.toFixed(2)} kWh</p>
                  </div>
                  <span className="px-2 py-1 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm">
                    {monthlyUsage.toFixed(0)} kWh/mo
                  </span>
                </div>
              </div>
              
              <div className="w-full sm:w-1/2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-sm text-gray-500 dark:text-gray-400">
                      {compareWith === 'national' ? 'National Average' : 'Similar Household Average'}
                    </h3>
                    <p className="text-2xl font-semibold">
                      {compareWith === 'national' ? nationalAvg : householdAvg} kWh
                    </p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-sm ${
                    (compareWith === 'national' ? nationalPercentage : householdPercentage) > 0
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                  }`}>
                    {Math.abs((compareWith === 'national' ? nationalPercentage : householdPercentage)).toFixed(0)}% 
                    {(compareWith === 'national' ? nationalPercentage : householdPercentage) > 0 ? ' Higher' : ' Lower'}
                  </span>
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="font-medium mb-3">Breakdown by Appliance</h3>
              {appliances.length > 0 ? (
                <div className="space-y-3">
                  {applianceComparisons.slice(0, 6).map((item, index) => (
                    <div key={index} className="flex items-center">
                      <div className="w-32 sm:w-40 font-medium truncate pr-2">{item.name}</div>
                      <div className="flex-1">
                        <div className="h-6 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${
                              item.percentage > 20 ? 'bg-red-500' :
                              item.percentage > 0 ? 'bg-amber-500' :
                              'bg-green-500'
                            }`}
                            style={{
                              width: `${
                                item.percentage > 100 ? 100 :
                                item.percentage < -100 ? 0 :
                                50 + (item.percentage / 2)
                              }%`
                            }}
                          ></div>
                        </div>
                      </div>
                      <div className="w-24 sm:w-28 flex items-center justify-end">
                        <span className={`text-sm ${
                          item.percentage > 20 ? 'text-red-600 dark:text-red-400' :
                          item.percentage > 0 ? 'text-amber-600 dark:text-amber-400' :
                          'text-green-600 dark:text-green-400'
                        }`}>
                          {getComparisonIndicator(item.percentage)}
                        </span>
                        <span className="ml-1 text-sm">
                          {item.userUsage.toFixed(1)} vs {item.avgUsage.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  Add appliances to see comparison by appliance type
                </p>
              )}
            </div>
          </>
        )}
      </div>
      
      {/* Historical Comparison */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Historical Usage Comparison</h2>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This chart shows your historical usage compared to average usage in your area.
          </p>
        </div>
        <EnergyUsageChart />
      </div>
      
      {/* Efficiency Score */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Your Energy Efficiency Score</h2>
        
        <div className="flex items-center justify-center py-4">
          <div className="relative">
            <div className="w-40 h-40 rounded-full border-8 border-gray-200 dark:border-gray-700 flex items-center justify-center">
              <div className="text-3xl font-bold">
                {householdPercentage < -20 ? 'A+' :
                 householdPercentage < -10 ? 'A' :
                 householdPercentage < 0 ? 'B' :
                 householdPercentage < 10 ? 'C' :
                 householdPercentage < 20 ? 'D' : 'E'}
              </div>
            </div>
            <div 
              className="absolute top-0 left-0 w-40 h-40 rounded-full border-8 border-t-transparent border-r-transparent"
              style={{
                borderLeftColor: 
                  householdPercentage < -10 ? '#10b981' :
                  householdPercentage < 10 ? '#f59e0b' : '#ef4444',
                borderBottomColor: 
                  householdPercentage < -10 ? '#10b981' :
                  householdPercentage < 10 ? '#f59e0b' : '#ef4444',
                transform: `rotate(${Math.min(180, Math.max(0, (householdPercentage + 50) * 1.8))}deg)`,
                transition: 'transform 1s ease-out'
              }}
            ></div>
          </div>
        </div>
        
        <div className="mt-4 text-center">
          <p className="font-medium">
            {householdPercentage < -20 ? 'Excellent! Your energy usage is very efficient.' :
             householdPercentage < -10 ? 'Great job! Your energy usage is better than most.' :
             householdPercentage < 0 ? 'Good! Your energy usage is slightly better than average.' :
             householdPercentage < 10 ? 'Average energy usage compared to similar households.' :
             householdPercentage < 20 ? 'Your energy usage is somewhat higher than average.' :
             'Your energy usage is significantly higher than average.'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            {householdPercentage > 0 
              ? 'Check the Insights page for personalized recommendations to improve your score.' 
              : 'Keep up the good work! Small changes can help you save even more.'}
          </p>
        </div>
      </div>
    </div>
  );
}
 