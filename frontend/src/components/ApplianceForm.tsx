// src/components/ApplianceForm.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAppContext, Appliance } from '../context/AppContext'
import { applianceTypes, locationOptions } from '../data/applianceDatabase'
import { useNotificationsCtx } from '../context/NotificationsContext'

type FormData = {
  name: string
  type: string
  wattage: string
  hoursPerDay: string
  daysPerWeek: string
  isHighEfficiency: boolean
  location: string
  brand: string
  model: string
  estimatedDailyKWh: string
}

export default function ApplianceForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    appliances,
    addAppliance,
    updateAppliance,
    getAppliance,
    getApplianceTypeInfo,
  } = useAppContext()

  const { addNotification, notifyHighUsageAppliance } = useNotificationsCtx()

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
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const THRESHOLD_KWH = 10

  // Populate when editing
  useEffect(() => {
    if (id) {
      const existing = getAppliance(id)
      if (existing) {
        setFormData({
          name: existing.name,
          type: existing.type,
          wattage: existing.wattage.toString(),
          hoursPerDay: existing.hoursPerDay.toString(),
          daysPerWeek: existing.daysPerWeek.toString(),
          isHighEfficiency: existing.isHighEfficiency,
          location: existing.location,
          brand: existing.brand || '',
          model: existing.model || '',
          estimatedDailyKWh:
            existing.estimatedDailyKWh != null
              ? existing.estimatedDailyKWh.toString()
              : '',
        })
      }
    }
  }, [id, getAppliance])

  // Default wattage on type change when adding
  useEffect(() => {
    if (!id && formData.type) {
      const info = getApplianceTypeInfo(formData.type)
      if (info) {
        setFormData(f => ({
          ...f,
          wattage: info.averageWattage.toString(),
        }))
      }
    }
  }, [formData.type, getApplianceTypeInfo, id])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, type, value, checked } = e.target as HTMLInputElement
    setFormData(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const validate = () => {
    const errs: Record<string, string> = {}
    const trimmed = formData.name.trim()
    if (!trimmed) errs.name = 'Name is required'
    if (
      !id &&
      appliances.some(
        a => a.name.trim().toLowerCase() === trimmed.toLowerCase()
      )
    ) {
      errs.name = 'You already have an appliance by that name'
    }
    const w = parseFloat(formData.wattage)
    if (isNaN(w) || w <= 0) errs.wattage = 'Wattage must be > 0'
    const h = parseFloat(formData.hoursPerDay)
    if (isNaN(h) || h < 0 || h > 24) errs.hoursPerDay = 'Hours/Day 0–24'
    const d = parseFloat(formData.daysPerWeek)
    if (isNaN(d) || d < 0 || d > 7) errs.daysPerWeek = 'Days/Week 0–7'
    if (formData.estimatedDailyKWh) {
      const e = parseFloat(formData.estimatedDailyKWh)
      if (isNaN(e) || e < 0) errs.estimatedDailyKWh = 'Must be ≥ 0'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

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
    }

    // Compute new daily usage
    const newUsage =
      finalAppliance.estimatedDailyKWh ??
      (finalAppliance.wattage *
        finalAppliance.hoursPerDay *
        finalAppliance.daysPerWeek) /
        7000

    if (id) {
      // Editing
      const existing = getAppliance(id)!
      const oldUsage =
        existing.estimatedDailyKWh ??
        (existing.wattage * existing.hoursPerDay) / 1000

      updateAppliance({ id, ...finalAppliance })

      // If crossed threshold upward
      if (oldUsage <= THRESHOLD_KWH && newUsage > THRESHOLD_KWH) {
        addNotification({
          type: 'warning',
          title: 'Appliance Usage Increased',
          message: `Your "${finalAppliance.name}" now uses ${newUsage.toFixed(
            2
          )} kWh/day—over the ${THRESHOLD_KWH} kWh threshold.`,
        })
        await notifyHighUsageAppliance(finalAppliance.name, newUsage)
      }
    } else {
      // Adding new
      addAppliance(finalAppliance)

      if (newUsage > THRESHOLD_KWH) {
        addNotification({
          type: 'warning',
          title: 'High Energy Appliance Added',
          message: `"${finalAppliance.name}" uses ${newUsage.toFixed(
            2
          )} kWh/day—over the ${THRESHOLD_KWH} kWh threshold.`,
        })
        await notifyHighUsageAppliance(finalAppliance.name, newUsage)
      }
    }

    navigate('/')
  }

  return (
    <div className="max-w-3xl mx-auto pb-16 sm:pb-0">
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="p-1 mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold dark:text-white">
          {id ? 'Edit Appliance' : 'Add New Appliance'}
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium dark:text-gray-300">
            Appliance Name *
          </label>
          <input
            name="name"
            type="text"
            value={formData.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g. Living Room TV"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Type */}
        <div>
          <label className="block text-sm font-medium dark:text-gray-300">
            Appliance Type *
          </label>
          <select
            name="type"
            value={formData.type}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300"
          >
            {applianceTypes.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium dark:text-gray-300">
            Location *
          </label>
          <select
            name="location"
            value={formData.location}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border-gray-300"
          >
            {locationOptions.map(loc => (
              <option key={loc} value={loc}>
                {loc}
              </option>
            ))}
          </select>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Brand (Optional)
            </label>
            <input
              name="brand"
              type="text"
              value={formData.brand}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              placeholder="e.g. Samsung"
            />
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Model (Optional)
            </label>
            <input
              name="model"
              type="text"
              value={formData.model}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              placeholder="e.g. QN90B"
            />
          </div>
        </div>

        {/* Power & Usage */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Power (Watts) *
            </label>
            <input
              name="wattage"
              type="number"
              min={1}
              value={formData.wattage}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md ${
                errors.wattage ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.wattage && (
              <p className="mt-1 text-sm text-red-500">{errors.wattage}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Hours/Day *
            </label>
            <input
              name="hoursPerDay"
              type="number"
              step={0.5}
              min={0}
              max={24}
              value={formData.hoursPerDay}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md ${
                errors.hoursPerDay ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.hoursPerDay && (
              <p className="mt-1 text-sm text-red-500">
                {errors.hoursPerDay}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Days/Week *
            </label>
            <input
              name="daysPerWeek"
              type="number"
              min={0}
              max={7}
              value={formData.daysPerWeek}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md ${
                errors.daysPerWeek ? 'border-red-500' : 'border-gray-300'
              }`}
            />
            {errors.daysPerWeek && (
              <p className="mt-1 text-sm text-red-500">
                {errors.daysPerWeek}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <input
              name="isHighEfficiency"
              type="checkbox"
              checked={formData.isHighEfficiency}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
            />
            <label className="text-sm dark:text-gray-300">
              High‑efficiency
            </label>
          </div>
        </div>

        {/* Estimated Daily kWh (add only) */}
        {!id && (
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Estimated Daily kWh (Optional)
            </label>
            <input
              name="estimatedDailyKWh"
              type="number"
              step={0.01}
              min={0}
              value={formData.estimatedDailyKWh}
              onChange={handleChange}
              className={`mt-1 block w-full rounded-md ${
                errors.estimatedDailyKWh
                  ? 'border-red-500'
                  : 'border-gray-300'
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

        {/* Actions */}
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
  )
}
