// src/components/ApplianceForm.tsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useAppContext, Appliance } from '../context/AppContext'
import { applianceTypes, locationOptions } from '../data/applianceDatabase'
import { useNotificationsCtx } from '../context/NotificationsContext'
import api from '../utils/api'
import { getAuthToken } from '../utils/auth'
import { getKwhPerDay } from '../utils/energyEstimator'

type FormData = {
  name: string
  type: string
  wattage: string
  hoursPerDay: string
  daysPerWeek: string
  isHighEfficiency: boolean
  active: boolean
  location: string
  brand: string
  model: string
  estimatedDailyKWh: string
}
type FormErrors = Record<keyof FormData, string>

export default function ApplianceForm() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const {
    appliances,
    addAppliance,
    updateAppliance,
    getAppliance,
    getApplianceTypeInfo,
    settings,
    appMode,
  } = useAppContext()
  const { addNotification, notifyHighUsageAppliance } = useNotificationsCtx()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    type: 'other',
    wattage: '100',
    hoursPerDay: '2',
    daysPerWeek: '7',
    isHighEfficiency: false,
    active: true,
    location: 'Other',
    brand: '',
    model: '',
    estimatedDailyKWh: '',
  })
  const [errors, setErrors] = useState<FormErrors>({} as FormErrors)
  const [globalError, setGlobalError] = useState<string>()
  const [loading, setLoading] = useState(false)
  const THRESHOLD_KWH = 10
  const MAX_WATTAGE = 10000
  const MAX_KWH_PER_DAY = 30


  // Load existing appliance into form when editing
  useEffect(() => {
    if (!id) return
  
    const idNum = Number(id)
    if (isNaN(idNum)) {
      // Optional: handle invalid id, e.g. redirect or show error
      return navigate('/')
    }
  
    const existing = getAppliance(idNum)
    if (!existing) return navigate('/')
  
    setFormData({
      name: existing.name,
      type: existing.type,
      wattage: existing.wattage.toString(),
      hoursPerDay: existing.hoursPerDay.toString(),
      daysPerWeek: existing.daysPerWeek.toString(),
      isHighEfficiency: existing.isHighEfficiency,
      active: existing.active ?? true,
      location: existing.location,
      brand: existing.brand ?? '',
      model: existing.model ?? '',
      estimatedDailyKWh: existing.estimatedDailyKWh?.toString() ?? '',
    })
  }, [id, getAppliance, navigate])
  

  // Auto-fill wattage average on type change (new only)
  useEffect(() => {
    if (id) return
    const info = getApplianceTypeInfo(formData.type)
    if (info) {
      setFormData(f => ({ ...f, wattage: info.averageWattage.toString() }))
    }
  }, [formData.type, getApplianceTypeInfo, id])

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, type, value, checked } = e.target as HTMLInputElement
    setFormData(f => ({
      ...f,
      [name]: type === 'checkbox' ? checked : value,
    }))
    if (errors[name as keyof FormData]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
    setGlobalError(undefined)
  }

  function validate(): boolean {
    const errs = {} as FormErrors
  
    const trimmedName = formData.name.trim()
    if (!trimmedName) errs.name = 'Name is required'
  
    if (
      !id &&
      appliances.some(a => a.name.toLowerCase() === trimmedName.toLowerCase())
    ) {
      errs.name = 'You already have an appliance by that name'
    }
  
    const w = parseFloat(formData.wattage)
    if (isNaN(w) || w <= 0) {
      errs.wattage = 'Wattage must be > 0'
    } else if (w > MAX_WATTAGE) {
      errs.wattage = `Wattage must be ≤ ${MAX_WATTAGE.toLocaleString()}`
    }
  
    const h = parseFloat(formData.hoursPerDay)
    if (isNaN(h) || h < 0 || h > 24) {
      errs.hoursPerDay = 'Hours/Day must be 0–24'
    }
  
    const d = parseFloat(formData.daysPerWeek)
    if (isNaN(d) || d < 0 || d > 7) {
      errs.daysPerWeek = 'Days/Week must be 0–7'
    }
  
    if (formData.estimatedDailyKWh) {
      const eVal = parseFloat(formData.estimatedDailyKWh)
      if (isNaN(eVal) || eVal < 0) {
        errs.estimatedDailyKWh = 'Must be ≥ 0'
      }
    }

    if (typeof formData.active !== 'boolean') {
      errs.active = 'Activity state is required'
    }
  
    // ✅ New: Daily kWh usage limit (e.g., 30 kWh/day max)
    const MAX_KWH_PER_DAY = 30
    if (!isNaN(w) && w > 0 && !isNaN(h) && h > 0 && !isNaN(d) && d >= 0) {
      const dailyKwh = getKwhPerDay({
        id: -1,
        name: trimmedName || 'temp',
        type: formData.type,
        wattage: w,
        hoursPerDay: h,
        daysPerWeek: d,
        isHighEfficiency: formData.isHighEfficiency,
        active: formData.active,
        location: formData.location,
      })
      if (dailyKwh > MAX_KWH_PER_DAY) {
        errs.hoursPerDay = `Daily usage exceeds ${MAX_KWH_PER_DAY} kWh/day limit`
      }
    }
  
    setErrors(errs)
    return Object.keys(errs).length === 0
  }
  


  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const base: Omit<Appliance, 'id'> = {
        name: formData.name.trim(),
        type: formData.type,
        wattage: +formData.wattage,
        hoursPerDay: +formData.hoursPerDay,
        daysPerWeek: +formData.daysPerWeek,
        isHighEfficiency: formData.isHighEfficiency,
        active: formData.active,
        location: formData.location,
        brand: formData.brand.trim() || undefined,
        model: formData.model.trim() || undefined,
        estimatedDailyKWh:
          formData.estimatedDailyKWh !== ''
            ? +formData.estimatedDailyKWh
            : undefined,
        deleted: false,
      }
      // compute daily usage
      const newUsage =
        base.estimatedDailyKWh ??
        getKwhPerDay(base, getApplianceTypeInfo)
      // edit or add flow
      if (id) {
        const idNum = Number(id)
        if (isNaN(idNum)) {
          // Handle invalid id (optional)
          return
        }
        const old = getAppliance(idNum)!
        const oldUsage =
          old.estimatedDailyKWh ??
          getKwhPerDay(old, getApplianceTypeInfo)
        updateAppliance({ id: idNum, ...base })
        if (oldUsage <= THRESHOLD_KWH && newUsage > THRESHOLD_KWH) {
          addNotification({
            type: 'warning',
            title: 'Appliance Usage Increased',
            message: `"${base.name}" now uses ${newUsage.toFixed(
              2
            )} kWh/day—over the ${THRESHOLD_KWH} kWh threshold.`,
          })
          await notifyHighUsageAppliance(base.name, newUsage)
        }
      }
      else {
        const saved = await addAppliance(base)  // call context function once, no direct POST here
      
        if (saved) {
          const token = getAuthToken()
          const shouldSendUsageLog = appMode === 'live' && Boolean(token)

          if (shouldSendUsageLog) {
            // log today's usage after successful add for authenticated live sessions
            const today = new Date().toISOString().slice(0, 10)
            await api.post('energy-usage', null, {
              params: {
                applianceId: saved.id,
                date: today,
                kWhUsed: newUsage,
              },
            })
          }
      
          if (newUsage > THRESHOLD_KWH) {
            addNotification({
              type: 'warning',
              title: 'High Energy Appliance Added',
              message: `"${base.name}" uses ${newUsage.toFixed(
                2
              )} kWh/day—over ${THRESHOLD_KWH} kWh threshold.`,
            })
            await notifyHighUsageAppliance(base.name, newUsage)
          }
        }
      }
      
      navigate('/')
    } catch (err: any) {
      console.error(err)
      setGlobalError('Failed to save. Please try again.')
    } finally {
      setLoading(false)
    }
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
        {globalError && (
          <div className="text-red-600 text-center">{globalError}</div>
        )}

        {/* Name */}
        <div>
          <label className="block text-sm font-medium dark:text-gray-300">
            Appliance Name *
          </label>
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            className={`mt-1 block w-full rounded-md border ${
              errors.name ? 'border-red-500' : 'border-gray-300'
            }`}
            placeholder="e.g. Living Room TV"
            disabled={loading}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Type & Location */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Appliance Type *
            </label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              disabled={loading}
            >
              {applianceTypes.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Location *
            </label>
            <select
              name="location"
              value={formData.location}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              disabled={loading}
            >
              {locationOptions.map(loc => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Brand & Model */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Brand (Optional)
            </label>
            <input
              name="brand"
              value={formData.brand}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              placeholder="e.g. Samsung"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium dark:text-gray-300">
              Model (Optional)
            </label>
            <input
              name="model"
              value={formData.model}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300"
              placeholder="e.g. QN90B"
              disabled={loading}
            />
          </div>
        </div>

        {/* Power & Usage */}
        <div className="grid grid-cols-3 gap-4 items-end">
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
              className={`mt-1 block w-full rounded-md border ${
                errors.wattage ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
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
              className={`mt-1 block w-full rounded-md border ${
                errors.hoursPerDay ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
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
              className={`mt-1 block w-full rounded-md border ${
                errors.daysPerWeek ? 'border-red-500' : 'border-gray-300'
              }`}
              disabled={loading}
            />
            {errors.daysPerWeek && (
              <p className="mt-1 text-sm text-red-500">
                {errors.daysPerWeek}
              </p>
            )}
          </div>
        </div>

        {/* High-efficiency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <input
              name="isHighEfficiency"
              type="checkbox"
              checked={formData.isHighEfficiency}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
              disabled={loading}
            />
            <label className="text-sm dark:text-gray-300">
              High-efficiency
            </label>
          </div>
          <div className="flex items-center space-x-2">
            <input
              name="active"
              type="checkbox"
              checked={formData.active}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300"
              disabled={loading}
            />
            <label className="text-sm dark:text-gray-300">
              Active in calculations
            </label>
          </div>
        </div>

        {/* Estimated kWh (add only) */}
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
              className={`mt-1 block w-full rounded-md border ${
                errors.estimatedDailyKWh
                  ? 'border-red-500'
                  : 'border-gray-300'
              }`}
              placeholder="e.g. 1.5"
              disabled={loading}
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
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading
              ? id
                ? 'Updating…'
                : 'Adding…'
              : id
              ? 'Update Appliance'
              : 'Add Appliance'}
          </button>
        </div>
      </form>
    </div>
  )
}
