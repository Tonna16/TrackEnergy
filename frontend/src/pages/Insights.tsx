import { useAppContext } from '../context/AppContext';
import EnergyUsageChart from '../components/EnergyUsageChart';
import { Lightbulb, AlertCircle } from 'lucide-react';
import { useMemo } from 'react';

export default function Insights() {
  const { appliances, totalDailyUsage, totalDailyCost, settings } = useAppContext();
  
  const CO2_EMISSIONS_FACTOR = 0.92;
  const totalYearlyUsage = totalDailyUsage * 365;
  const totalYearlyCost = totalDailyCost * 365;
  const totalCarbonFootprint = totalYearlyUsage * CO2_EMISSIONS_FACTOR;

  const appliancesByUsage = useMemo(() => {
    return [...appliances]
      .map(appliance => ({
        name: appliance.name,
        usage: (appliance.wattage * appliance.hoursPerDay * appliance.daysPerWeek / 7) / 1000,
        appliance
      }))
      .sort((a, b) => b.usage - a.usage);
  }, [appliances]);

  const topConsumers = appliancesByUsage.slice(0, 5);

  const tips = [
    {
      title: "Replace inefficient appliances",
      description: "Look for ENERGY STAR rated replacements for your highest energy consumers.",
      impact: "Could save up to 15% on your electricity bill."
    },
    {
      title: "Install programmable thermostats",
      description: "Automatically adjust temperature when you're away or sleeping.",
      impact: "Could save up to 10% annually on heating and cooling costs."
    },
    {
      title: "Smart power strips",
      description: "Eliminate phantom energy use from electronics when not in use.",
      impact: "Could save up to 5% on your electricity bill."
    },
    {
      title: "LED lighting upgrade",
      description: "Replace all remaining incandescent bulbs with LEDs.",
      impact: "LEDs use 75% less energy than traditional bulbs."
    }
  ];
  
  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Energy Insights</h1>
      
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400">Daily Energy Usage</h2>
          <p className="text-2xl font-semibold mt-1">{totalDailyUsage.toFixed(2)} kWh</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {totalDailyUsage > 10 ? 'Above' : 'Below'} average for your household size
          </p>
        </div>
        
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400">Annual Cost Estimate</h2>
          <p className="text-2xl font-semibold mt-1">
            {settings.currency === 'USD' ? '$' : '€'}{totalYearlyCost.toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Based on your current usage patterns
          </p>
        </div>
        
        <div className="card">
          <h2 className="text-sm text-gray-500 dark:text-gray-400">Carbon Footprint</h2>
          <p className="text-2xl font-semibold mt-1">
            {totalCarbonFootprint.toFixed(2)} kg CO₂
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Estimated annual emissions from your electricity use
          </p>
        </div>
      </div>
      
      {/* Top Consumers */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Top Energy Consumers</h2>
        {appliances.length > 0 ? (
          <>
            <div className="mb-6">
              <EnergyUsageChart height={250} useEstimate={false} />
            </div>
            <div className="space-y-4">
              {topConsumers.map((item, index) => (
                <div key={index} className="flex items-start">
                  <div className={`flex-shrink-0 w-1 h-full min-h-[50px] rounded-full ${
                    index === 0 ? 'bg-red-500' : 
                    index === 1 ? 'bg-orange-500' : 
                    index === 2 ? 'bg-amber-500' : 
                    'bg-yellow-500'
                  }`}></div>
                  <div className="ml-4 flex-1">
                    <div className="flex justify-between">
                      <h3 className="font-medium">{item.appliance.name}</h3>
                      <p className="font-medium">{item.usage.toFixed(2)} kWh/day</p>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.appliance.wattage} watts, {item.appliance.hoursPerDay} hrs/day
                    </p>
                    {index === 0 && (
                      <div className="mt-2 text-sm bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300 p-2 rounded-lg">
                        <div className="flex">
                          <AlertCircle className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5" />
                          <div>
                            <span className="font-medium">Energy hog alert: </span>
                            Consider replacing with an energy-efficient model to save approximately 
                            {settings.currency === 'USD' ? '$' : '€'}{((Number(item.usage) * 365 * Number(settings.electricityRate) * 0.3).toFixed(2))} per year.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">
            Add appliances to see your top energy consumers
          </p>
        )}
      </div>
      
      {/* Energy Saving Recommendations */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Recommendations to Save Energy</h2>
        <div className="space-y-4">
          {tips.map((tip, index) => (
            <div key={index} className="flex">
              <div className="flex-shrink-0 mt-1">
                <Lightbulb className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="ml-3">
                <h3 className="font-medium">{tip.title}</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{tip.description}</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-1">{tip.impact}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Energy Use Over Time */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Your Energy Trends</h2>
        <EnergyUsageChart useEstimate={false} />
      </div>
    </div>
  );
}
