import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { useAppContext, Appliance } from '../context/AppContext';
import { applianceTypes, locationOptions } from '../data/applianceDatabase';

type FormData = {
  name: string;
  type: string;
  wattage: string;
  hoursPerDay: string;
  daysPerWeek: string;
  isHighEfficiency: boolean;
  location: string;
  brand: string;
  model: string;
  estimatedDailyKWh: string; // store as string for input control
};

export default function ApplianceForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    appliances,
    addAppliance,
    updateAppliance,
    getAppliance,
    getApplianceTypeInfo,
  } = useAppContext();

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'other',
    wattage: '100',
    hoursPerDay: '2',
    daysPerWeek: '7',
    isHighEfficiency: false,
    location: 'Other',
    brand: '',
    model: '',
    estimatedDailyKWh: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Load existing appliance if editing
  useEffect(() => {
    if (id) {
      const existing = getAppliance(id);
      if (existing) {
        setFormData({
          name: existing.name,
          type: existing.type,
          wattage: existing.wattage.toString(),
          hoursPerDay: existing.hoursPerDay.toString(),
          daysPerWeek: existing.daysPerWeek.toString(),
          isHighEfficiency: existing.isHighEfficiency,
          location: existing.location,
          brand: existing.brand ?? '',
          model: existing.model ?? '',
          estimatedDailyKWh:
            existing.estimatedDailyKWh !== undefined
              ? existing.estimatedDailyKWh.toString()
              : '',
        });
      }
    }
  }, [id, getAppliance]);

  // On new appliance type change, update wattage default as string
  useEffect(() => {
    if (!id && formData.type) {
      const info = getApplianceTypeInfo(formData.type);
      if (info) {
        setFormData((fd) => ({ ...fd, wattage: info.averageWattage.toString() }));
      }
    }
  }, [formData.type, getApplianceTypeInfo, id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement;

    setFormData((fd) => ({
      ...fd,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: '' }));
    }
  };

  // Validate after parsing strings to numbers where needed
  const validate = () => {
    const newErrs: Record<string, string> = {};
    const trimmedName = formData.name.trim();

    if (!trimmedName) newErrs.name = 'Name is required';
    if (
      !id &&
      appliances.some(
        (a) => a.name.trim().toLowerCase() === trimmedName.toLowerCase()
      )
    ) {
      newErrs.name = 'You already have an appliance by that name';
    }

    // Parse numeric fields
    const wattageNum = parseFloat(formData.wattage);
    if (isNaN(wattageNum) || wattageNum <= 0) {
      newErrs.wattage = 'Wattage must be greater than 0';
    }

    const hoursNum = parseFloat(formData.hoursPerDay);
    if (isNaN(hoursNum) || hoursNum < 0 || hoursNum > 24) {
      newErrs.hoursPerDay = 'Hours/Day must be between 0 and 24';
    }

    const daysNum = parseFloat(formData.daysPerWeek);
    if (isNaN(daysNum) || daysNum < 0 || daysNum > 7) {
      newErrs.daysPerWeek = 'Days/Week must be between 0 and 7';
    }

    if (formData.estimatedDailyKWh !== '') {
      const estNum = parseFloat(formData.estimatedDailyKWh);
      if (isNaN(estNum) || estNum < 0) {
        newErrs.estimatedDailyKWh = 'Must be a non-negative number';
      }
    }

    setErrors(newErrs);
    return Object.keys(newErrs).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    // Prepare final appliance object with parsed numbers
    const finalAppliance: Omit<Appliance, 'id'> = {
      name: formData.name.trim(),
      type: formData.type,
      wattage: parseFloat(formData.wattage),
      hoursPerDay: parseFloat(formData.hoursPerDay),
      daysPerWeek: parseFloat(formData.daysPerWeek),
      isHighEfficiency: formData.isHighEfficiency,
      location: formData.location,
      brand: formData.brand.trim() || undefined,
      model: formData.model.trim() || undefined,
      estimatedDailyKWh:
        formData.estimatedDailyKWh !== ''
          ? parseFloat(formData.estimatedDailyKWh)
          : undefined,
    };

    try {
      if (id) {
        updateAppliance({ id, ...finalAppliance });
      } else {
        addAppliance(finalAppliance);
      }
      navigate('/');
    } catch (err: any) {
      setErrors({ name: err.message || 'An unexpected error occurred' });
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

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Appliance Name *
          </label>
          <input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
              errors.name ? 'border-red-500' : ''
            }`}
            placeholder="e.g. Living Room TV"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label
            htmlFor="type"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Appliance Type *
          </label>
          <select
            id="type"
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {applianceTypes.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label
            htmlFor="location"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300"
          >
            Location *
          </label>
          <select
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {locationOptions.map((loc) => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="brand"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Brand (Optional)
            </label>
            <input
              id="brand"
              name="brand"
              type="text"
              value={formData.brand}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. Samsung"
            />
          </div>
          <div>
            <label
              htmlFor="model"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Model (Optional)
            </label>
            <input
              id="model"
              name="model"
              type="text"
              value={formData.model}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="e.g. QN90B"
            />
          </div>
        </div>

        {/* Power & Usage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="wattage"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Power (Watts) *
            </label>
            <input
              id="wattage"
              name="wattage"
              type="number"
              value={formData.wattage}
              onChange={handleChange}
              min={1}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.wattage ? 'border-red-500' : ''
              }`}
            />
            {errors.wattage && (
              <p className="mt-1 text-sm text-red-500">{errors.wattage}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="hoursPerDay"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Hours/Day *
            </label>
            <input
              id="hoursPerDay"
              name="hoursPerDay"
              type="number"
              step="0.5"
              value={formData.hoursPerDay}
              onChange={handleChange}
              min={0}
              max={24}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.hoursPerDay ? 'border-red-500' : ''
              }`}
            />
            {errors.hoursPerDay && (
              <p className="mt-1 text-sm text-red-500">{errors.hoursPerDay}</p>
            )}
          </div>
          <div>
            <label
              htmlFor="daysPerWeek"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Days/Week *
            </label>
            <input
              id="daysPerWeek"
              name="daysPerWeek"
              type="number"
              value={formData.daysPerWeek}
              onChange={handleChange}
              min={0}
              max={7}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.daysPerWeek ? 'border-red-500' : ''
              }`}
            />
            {errors.daysPerWeek && (
              <p className="mt-1 text-sm text-red-500">{errors.daysPerWeek}</p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input
              id="isHighEfficiency"
              name="isHighEfficiency"
              type="checkbox"
              checked={formData.isHighEfficiency}
              onChange={handleChange}
              className="h-4 w-4 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
            />
            <label
              htmlFor="isHighEfficiency"
              className="text-sm text-gray-700 dark:text-gray-300"
            >
              High-efficiency
            </label>
          </div>
        </div>

        {/* Estimated Daily kWh (Add Mode Only) */}
        {!id && (
          <div>
            <label
              htmlFor="estimatedDailyKWh"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300"
            >
              Estimated Daily kWh (Optional)
            </label>
            <input
              id="estimatedDailyKWh"
              name="estimatedDailyKWh"
              type="number"
              step="0.01"
              value={formData.estimatedDailyKWh}
              onChange={handleChange}
              min={0}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                errors.estimatedDailyKWh ? 'border-red-500' : ''
              }`}
              placeholder="e.g. 1.5"
            />
            {errors.estimatedDailyKWh && (
              <p className="mt-1 text-sm text-red-500">
                {errors.estimatedDailyKWh}
              </p>
            )}
          </div>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 mt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button type="submit" className="btn btn-primary">
            {id ? 'Update Appliance' : 'Add Appliance'}
          </button>
        </div>
      </form>
    </div>
  );
}
