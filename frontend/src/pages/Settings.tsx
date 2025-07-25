import { useState, useEffect, useRef } from 'react'
import { Check, DollarSign, Home, HelpCircle } from 'lucide-react'
import { useAppContext } from '../context/AppContext'
import { useNotificationsCtx } from '../context/NotificationsContext'

export default function Settings() {
  const { settings, updateSettings, fetchLiveRate } = useAppContext()
  const { addNotification, notifyExchangeRate } = useNotificationsCtx()

  const [formData, setFormData] = useState({ ...settings })
  const [showSaveSuccess, setShowSaveSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setFormData({ ...settings })
  }, [settings])

  const prevSettingsRef = useRef(settings)
  useEffect(() => {
    prevSettingsRef.current = settings
  }, [settings])

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type, checked } = e.target as HTMLInputElement
    setFormData(prev => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
          ? parseFloat(value)
          : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const old = prevSettingsRef.current
      const next = formData

      if (next.currency !== old.currency) {
        let newRate: number
        let newElectricityRate: number

        if (next.currency === 'EUR') {
          newRate = await fetchLiveRate('EUR')
          newElectricityRate = old.electricityRate * newRate
        } else {
          newRate = 1
          newElectricityRate = old.electricityRate / old.exchangeRate
        }

        updateSettings({
          ...next,
          exchangeRate: newRate,
          electricityRate: newElectricityRate,
        })

        await notifyExchangeRate(
          next.currency,
          newRate,
          newElectricityRate,
          new Date().toISOString().slice(0, 10)
        )
      } else {
        updateSettings(next)
        if (next.electricityRate !== old.electricityRate) {
          addNotification({
            type: 'info',
            title: 'Electricity Rate Updated',
            message: `Electricity rate is now ${next.currency} ${next.electricityRate.toFixed(
              4
            )}/kWh.`,
          })
        }
      }

      setShowSaveSuccess(true)
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => setShowSaveSuccess(false), 3000)
    } catch (e) {
      setError('Failed to save settings. Please try again.')
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const symbol = formData.currency === 'USD' ? '$' : '€'

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
              <label
                htmlFor="electricityRate"
                className="block text-sm font-medium dark:text-gray-300"
              >
                Electricity Rate ({symbol}/kWh)
              </label>
              <input
                type="number"
                step="0.0001"
                min="0.0001"
                id="electricityRate"
                name="electricityRate"
                value={formData.electricityRate}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                disabled={saving}
              />
            </div>
            <div>
              <label
                htmlFor="currency"
                className="block text-sm font-medium dark:text-gray-300"
              >
                Currency
              </label>
              <select
                id="currency"
                name="currency"
                value={formData.currency}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
                disabled={saving}
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
            <label
              htmlFor="householdSize"
              className="block text-sm font-medium dark:text-gray-300"
            >
              Household Size
            </label>
            <select
              id="householdSize"
              name="householdSize"
              value={formData.householdSize}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 dark:bg-gray-700 dark:text-white"
              disabled={saving}
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
              disabled={saving}
            />
            <label
              htmlFor="darkMode"
              className="ml-2 block text-sm font-medium dark:text-gray-300"
            >
              Dark Mode
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className={`px-6 py-2 rounded-md text-white ${
              saving ? 'bg-gray-400 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            Save Settings
          </button>
        </div>
      </form>

      {showSaveSuccess && (
        <div className="fixed bottom-6 right-6 bg-emerald-500 text-white px-4 py-2 rounded-lg shadow">
          <Check className="h-5 w-5 inline-block mr-2" />
          Settings saved successfully
        </div>
      )}

      {error && (
        <div className="fixed bottom-16 right-6 bg-red-600 text-white px-4 py-2 rounded-lg shadow">
          {error}
        </div>
      )}
    </div>
  )
}
