import  { useState } from 'react';
import { Check, User, DollarSign, Home, HelpCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Settings() {
  const { settings, updateSettings } = useAppContext();
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  
  const [formData, setFormData] = useState({
    name: settings.name,
    electricityRate: settings.electricityRate,
    currency: settings.currency,
    householdSize: settings.householdSize,
    darkMode: settings.darkMode
  });
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'checkbox') {
      setFormData({
        ...formData,
        [(e.target as HTMLInputElement).name]: (e.target as HTMLInputElement).checked
      });
    } else if (type === 'number') {
      setFormData({
        ...formData,
        [name]: parseFloat(value)
      });
    } else {
      setFormData({
        ...formData,
        [name]: value
      });
    }
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(formData);
    setShowSaveSuccess(true);
    setTimeout(() => setShowSaveSuccess(false), 3000);
  };
  
  return (
    <div className="max-w-3xl mx-auto pb-16 sm:pb-0">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings</h1>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Profile Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <User className="h-5 w-5 mr-2 text-gray-500" /> 
            Profile Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Your Name
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              />
            </div>
          </div>
        </div>
        
        {/* Electricity Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <DollarSign className="h-5 w-5 mr-2 text-gray-500" /> 
            Electricity Settings
          </h2>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:space-x-4">
              <div className="flex-1">
                <label htmlFor="electricityRate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Electricity Rate (per kWh)
                </label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 sm:text-sm">
                      {formData.currency === 'USD' ? '$' : '€'}
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    id="electricityRate"
                    name="electricityRate"
                    value={formData.electricityRate}
                    onChange={handleChange}
                    className="block w-full pl-7 pr-12 rounded-md border-gray-300 focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>
              </div>
              
              <div className="flex-1 mt-4 md:mt-0">
                <label htmlFor="currency" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Currency
                </label>
                <select
                  id="currency"
                  name="currency"
                  value={formData.currency}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>
            </div>
          </div>
        </div>
        
        {/* Household Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <Home className="h-5 w-5 mr-2 text-gray-500" /> 
            Household Settings
          </h2>
          <div className="space-y-4">
            <div>
              <label htmlFor="householdSize" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Household Size (number of people)
              </label>
              <select
                id="householdSize"
                name="householdSize"
                value={formData.householdSize}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value={1}>1 person</option>
                <option value={2}>2 people</option>
                <option value={3}>3 people</option>
                <option value={4}>4 people</option>
                <option value={5}>5+ people</option>
              </select>
            </div>
          </div>
        </div>
        
        {/* App Settings */}
        <div className="card">
          <h2 className="text-lg font-medium mb-4 flex items-center">
            <HelpCircle className="h-5 w-5 mr-2 text-gray-500" /> 
            App Settings
          </h2>
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="darkMode"
                name="darkMode"
                checked={formData.darkMode}
                onChange={handleChange}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="darkMode" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Dark Mode
              </label>
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button
            type="submit"
            className="btn btn-primary px-6"
          >
            Save Settings
          </button>
        </div>
      </form>
      
      {/* Save Success Message */}
      {showSaveSuccess && (
        <div className="fixed bottom-4 right-4 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center">
          <Check className="h-5 w-5 mr-2" /> 
          Settings saved successfully
        </div>
      )}
      
      {/* About section */}
      <div className="mt-12">
        <div className="card">
          <h2 className="text-lg font-medium mb-2">About WattWatch</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Version 1.0.0 &middot; Created with ❤️ by the WattWatch team
          </p>
          <div className="mt-6 pt-6 border-t dark:border-gray-700">
            <img 
              src="https://images.unsplash.com/photo-1532372576444-dda954194ad0"
              alt="Energy-efficient home" 
              className="w-full h-48 object-cover rounded-lg mb-2" 
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              WattWatch helps you track and reduce your energy consumption, save money, and reduce your carbon footprint.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
 