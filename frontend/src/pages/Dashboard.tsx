// src/pages/Dashboard.tsx
import { Plus, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import ApplianceCard from '../components/ApplianceCard';
import EnergyUsageChart from '../components/EnergyUsageChart';
import UsageSummary from '../components/UsageSummary';

export default function Dashboard() {
  const { appliances, dailyUsageSeries } = useAppContext();
  const navigate = useNavigate();
  const hasLimitedData = dailyUsageSeries.length < 5;

  return (
    <div className="space-y-6">
      {hasLimitedData && (
        <div className="flex items-start space-x-3 bg-yellow-100 text-yellow-800 border rounded-md p-4">
          <AlertCircle size={20} />
          <div className="flex-1">
            <p className="font-medium">Projections Based on Estimates</p>
            <p className="text-sm mt-1">
              Your current energy usage projections are based on estimated data. Add real usage data to improve accuracy.
            </p>
          </div>
          <button
            onClick={() => navigate('/log-usage')}
            className="ml-4 inline-flex px-3 py-1.5 text-sm font-medium text-white bg-emerald-600 rounded-md"
          >
            Add Usage
          </button>
        </div>
      )}

      <div className="space-y-6 pb-16 sm:pb-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <Link
            to="/add-appliance"
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg"
          >
            <Plus className="w-5 h-5 mr-1" />
            Add Appliance
          </Link>
        </div>

        <UsageSummary useEstimate={hasLimitedData} />

        <div className="card">
          <h2 className="text-lg font-medium mb-4">Energy Usage Over Time</h2>
          <EnergyUsageChart useEstimate={hasLimitedData} />
        </div>

        <div>
          <h2 className="text-lg font-medium mb-4">Your Appliances</h2>
          {appliances.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {appliances.map(appl => (
                <ApplianceCard key={appl.id} appliance={appl} />
              ))}
            </div>
          ) : (
            <div className="card flex flex-col items-center py-8">
              <img
                src="https://images.unsplash.com/photo-1519710164239-da123dc03ef4"
                alt="Empty state"
                className="w-64 h-48 object-cover rounded-lg mb-4"
              />
              <h3 className="text-lg font-medium">
                No appliances added yet
              </h3>
              <p className="text-gray-500 text-center max-w-md mt-2 mb-4">
                Start monitoring your energy usage by adding your first appliance.
              </p>
              <Link to="/add-appliance" className="btn btn-primary">
                Add Your First Appliance
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
