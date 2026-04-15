import { useState } from 'react'
import { Download } from 'lucide-react'
import api from '../utils/api'

async function downloadReport(period: 'weekly' | 'monthly') {
  const response = await api.get(`/energy-usage/report?period=${period}`, {
    responseType: 'blob',
  })

  const blob = new Blob([response.data], { type: 'application/pdf' })
  const link = document.createElement('a')
  const dateTag = new Date().toISOString().slice(0, 10)
  link.href = URL.createObjectURL(blob)
  link.download = `energy-report-${period}-${dateTag}.pdf`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(link.href)
}

export default function UsageReportDownloads() {
  const [loadingPeriod, setLoadingPeriod] = useState<'weekly' | 'monthly' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleDownload = async (period: 'weekly' | 'monthly') => {
    setLoadingPeriod(period)
    setError(null)

    try {
      await downloadReport(period)
    } catch (err) {
      console.error(`Failed to download ${period} report`, err)
      setError('Could not generate report right now. Please try again in a moment.')
    } finally {
      setLoadingPeriod(null)
    }
  }

  return (
    <div className="card surface-glass">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Energy Reports (PDF)</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Download polished usage + cost reports for weekly or monthly windows.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleDownload('weekly')}
            disabled={loadingPeriod !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
          >
            <Download size={16} />
            {loadingPeriod === 'weekly' ? 'Generating Weekly…' : 'Download Weekly PDF'}
          </button>

          <button
            onClick={() => handleDownload('monthly')}
            disabled={loadingPeriod !== null}
            className="inline-flex items-center gap-2 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
          >
            <Download size={16} />
            {loadingPeriod === 'monthly' ? 'Generating Monthly…' : 'Download Monthly PDF'}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
