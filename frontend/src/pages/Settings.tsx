// src/pages/Settings.tsx
import { useState } from 'react';
import { Check, DollarSign, Home, HelpCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Settings() {
  const { settings, updateSettings } = useAppContext();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);

  const [formData, setFormData] = useState({
    electricityRate: settings.electricityRate,
    currency: settings.currency,
    householdSize: settings.householdSize,
    darkMode: settings.darkMode,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type, checked } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked
        : type === 'number' ? parseFloat(value)
        : value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };

  const symbol = formData.currency === 'USD' ? '$' : '€';

  return (
    <div className="max-w-3xl mx-auto pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold dark:text-white mb-6">Settings</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Electricity Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            Electricity Settings
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="electricityRate" className="block text-sm font-medium dark:text-gray-300">
                Electricity Rate ({symbol}/kWh)
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                id="electricityRate"
                name="electricityRate"
                value={formData.electricityRate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <label htmlFor="currency" className="block text-sm font-medium dark:text-gray-300">
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Household Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Home className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            Household Settings
          </h2>
          <div>
            <label htmlFor="householdSize" className="block text-sm font-medium dark:text-gray-300">
              Household Size
            </label>
            <select
              id="householdSize"
              name="householdSize"
              value={formData.householdSize}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
            >
              <option value={1}>1 person</option>
              <option value={2}>2 people</option>
              <option value={3}>3 people</option>
              <option value={4}>4 people</option>
              <option value={5}>5+ people</option>
            </select>
          </div>
        </div>

        {/* App Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <HelpCircle className="h-5 w-5 mr-2 text-gray-500 dark:text-gray-400" />
            App Settings
          </h2>
          <div className="flex items-center">
            <input
              type="checkbox"
              id="darkMode"
              name="darkMode"
              checked={formData.darkMode}
              onChange={handleChange}
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded dark:bg-gray-700"
            />
            <label htmlFor="darkMode" className="ml-2 block text-sm font-medium dark:text-gray-300">
              Dark Mode
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2 bg-emerald-600 text-white rounded-md hover:bg-emerald-700"
          >
            Save Settings
          </button>
        </div>
      </form>

      {/* Save Success Toast */}
      {showSaveSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow">
          <Check className="h-5 w-5 inline-block mr-2" /> Settings saved successfully
        </div>
      )}
    </div>
  );
}
