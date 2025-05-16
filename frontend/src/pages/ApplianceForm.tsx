import  { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppContext, Appliance } from '../context/AppContext';
import { applianceTypes, locationOptions } from '../data/applianceDatabase';
import axios from 'axios';

export default function ApplianceForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addAppliance, updateAppliance, getAppliance, getApplianceTypeInfo } = useAppContext();
  
  const [formData, setFormData] = useState<Omit<Appliance, 'id'>>({
    name: '',
    type: 'other',
    wattage: 100,
    hoursPerDay: 2,
    daysPerWeek: 7,
    isHighEfficiency: false,
    location: 'Other'
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Load existing appliance data if editing
  useEffect(() => {
    if (id) {
      const appliance = getAppliance(id);
      if (appliance) {
        setFormData({
          name: appliance.name,
          type: appliance.type,
          brand: appliance.brand,
          model: appliance.model,
          wattage: appliance.wattage,
          hoursPerDay: appliance.hoursPerDay,
          daysPerWeek: appliance.daysPerWeek,
          isHighEfficiency: appliance.isHighEfficiency,
          location: appliance.location
        });
      }
    }
  }, [id, getAppliance]);
  
  // Update wattage when appliance type changes
  useEffect(() => {
    if (!id && formData.type) {
      const typeInfo = getApplianceTypeInfo(formData.type);
      setFormData(prev => ({
        ...prev,
        wattage: typeInfo.defaultWattage
      }));
    }
  }, [formData.type, getApplianceTypeInfo, id]);
  
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
    
    // Clear error for this field
    if (errors[name]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };
  
  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (formData.wattage <= 0) {
      newErrors.wattage = 'Wattage must be greater than 0';
    }
    
    if (formData.hoursPerDay < 0 || formData.hoursPerDay > 24) {
      newErrors.hoursPerDay = 'Hours must be between 0 and 24';
    }
    
    if (formData.daysPerWeek < 0 || formData.daysPerWeek > 7) {
      newErrors.daysPerWeek = 'Days must be between 0 and 7';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (validate()) {
      if (id) {
        updateAppliance(id, formData);
      } else {
        addAppliance(formData);
      }
      navigate('/');
    }
  };
  
  return (
    <div className="max-w-3xl mx-auto pb-16 sm:pb-0">
      <div className="flex items-center mb-6">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-1 mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          {id ? 'Edit Appliance' : 'Add New Appliance'}
        </h1>
      </div>
      
      <form onSubmit={handleSubmit} className="card">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="col-span-2">
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Appliance Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.name ? 'border-red-500' : ''
                }`}
                placeholder="e.g. Living Room TV"
              />
              {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
            </div>
            
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Appliance Type *
              </label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {applianceTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Location *
              </label>
              <select
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="flex space-x-4">
              <div className="flex-1">
                <label htmlFor="brand" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  id="brand"
                  name="brand"
                  value={formData.brand || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g. Samsung"
                />
              </div>
              
              <div className="flex-1">
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Model (Optional)
                </label>
                <input
                  type="text"
                  id="model"
                  name="model"
                  value={formData.model || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="e.g. QN90B"
                />
              </div>
            </div>
          </div>
          
          {/* Power Usage */}
          <div className="space-y-4">
            <div>
              <label htmlFor="wattage" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Power Consumption (Watts) *
              </label>
              <input
                type="number"
                id="wattage"
                name="wattage"
                value={formData.wattage}
                onChange={handleChange}
                min="1"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.wattage ? 'border-red-500' : ''
                }`}
              />
              {errors.wattage && <p className="mt-1 text-sm text-red-500">{errors.wattage}</p>}
            </div>
            
            <div>
              <label htmlFor="hoursPerDay" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Hours Used Per Day *
              </label>
              <input
                type="number"
                id="hoursPerDay"
                name="hoursPerDay"
                value={formData.hoursPerDay}
                onChange={handleChange}
                min="0"
                max="24"
                step="0.5"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.hoursPerDay ? 'border-red-500' : ''
                }`}
              />
              {errors.hoursPerDay && <p className="mt-1 text-sm text-red-500">{errors.hoursPerDay}</p>}
            </div>
            
            <div>
              <label htmlFor="daysPerWeek" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Days Used Per Week *
              </label>
              <input
                type="number"
                id="daysPerWeek"
                name="daysPerWeek"
                value={formData.daysPerWeek}
                onChange={handleChange}
                min="0"
                max="7"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.daysPerWeek ? 'border-red-500' : ''
                }`}
              />
              {errors.daysPerWeek && <p className="mt-1 text-sm text-red-500">{errors.daysPerWeek}</p>}
            </div>
            
            <div className="flex items-center h-10">
              <input
                type="checkbox"
                id="isHighEfficiency"
                name="isHighEfficiency"
                checked={formData.isHighEfficiency}
                onChange={handleChange}
                className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
              />
              <label htmlFor="isHighEfficiency" className="ml-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
                This is a high-efficiency appliance
              </label>
            </div>
          </div>
        </div>
        
        <div className="mt-8 flex justify-end space-x-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
          >
            {id ? 'Update Appliance' : 'Add Appliance'}
          </button>
        </div>
      </form>
    </div>
  );
}
 