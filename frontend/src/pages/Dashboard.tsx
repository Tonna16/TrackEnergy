import  { Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ApplianceCard from '../components/ApplianceCard';
import EnergyUsageChart from '../components/EnergyUsageChart';
import UsageSummary from '../components/UsageSummary';

export default function Dashboard() {
  const { appliances } = useAppContext();
  
  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <div className="mt-3 sm:mt-0">
          <Link
            to="/add-appliance"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors"
          >
            <Plus className="h-5 w-5 mr-1" />
            Add Appliance
          </Link>
        </div>
      </div>
      
      {/* Summary Statistics */}
      <UsageSummary />
      
      {/* Energy Usage Over Time */}
      <div className="card">
        <h2 className="text-lg font-medium mb-4">Energy Usage Over Time</h2>
        <EnergyUsageChart />
      </div>
      
      {/* Appliance List */}
      <div>
        <h2 className="text-lg font-medium mb-4">Your Appliances</h2>
        {appliances.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {appliances.map((appliance) => (
              <ApplianceCard key={appliance.id} appliance={appliance} />
            ))}
          </div>
        ) : (
          <div className="card flex flex-col items-center py-8">
            <img
              src="https://images.unsplash.com/photo-1519710164239-da123dc03ef4"
              alt="Empty home interior"
              className="w-64 h-48 object-cover rounded-lg mb-4"
            />
            <h3 className="text-lg font-medium">No appliances added yet</h3>
            <p className="text-gray-500 dark:text-gray-400 text-center max-w-md mt-2 mb-4">
              Start monitoring your energy usage by adding your first appliance.
            </p>
            <Link
              to="/add-appliance"
              className="btn btn-primary"
            >
              Add Your First Appliance
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
 