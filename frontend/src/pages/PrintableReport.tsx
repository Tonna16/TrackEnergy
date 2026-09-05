import { useMemo, useState } from 'react';
import { ArrowLeft, Printer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { CARBON_KG_PER_KWH, getKwhPerDay } from '../utils/energyCalculations';

const isoDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const labelDate = (date: string) => new Intl.DateTimeFormat(undefined, {
  year: 'numeric', month: 'short', day: 'numeric',
}).format(new Date(`${date}T12:00:00`));

export default function PrintableReport() {
  const {
    trackedAppliances,
    settings,
    formatCost,
    getPrintableReportSummary,
  } = useAppContext();
  const [period, setPeriod] = useState<7 | 30>(7);

  const report = useMemo(() => getPrintableReportSummary(period), [getPrintableReportSummary, period]);

  return (
    <article className="print-report mx-auto max-w-5xl space-y-5 pb-16 sm:pb-0">
      <div className="print-hidden flex flex-wrap items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-300">
          <ArrowLeft size={17} /> Back to Dashboard
        </Link>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setPeriod(7)} className={`btn ${period === 7 ? 'btn-primary' : 'btn-outline'}`}>Weekly</button>
          <button onClick={() => setPeriod(30)} className={`btn ${period === 30 ? 'btn-primary' : 'btn-outline'}`}>Monthly</button>
          <button onClick={() => window.print()} className="btn btn-primary inline-flex items-center gap-2">
            <Printer size={17} /> Print / Save as PDF
          </button>
        </div>
      </div>

      <header className="border-b border-gray-200 pb-4 dark:border-gray-700">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600">EnergyIQ Local Demo</p>
        <h1 className="mt-1 text-3xl font-bold">{period === 7 ? 'Weekly' : 'Monthly'} Energy Report</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {labelDate(report.startDate)}–{labelDate(report.endDate)} · Generated {labelDate(isoDate(new Date()))}
        </p>
      </header>

      {report.includesSample && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Sample-data warning: this report includes deterministic demonstration observations, not actual household records.
        </div>
      )}

      <div className={`rounded-lg border p-4 ${report.usesHistory ? 'border-sky-200 bg-sky-50' : 'border-amber-300 bg-amber-50'} dark:bg-transparent`}>
        <h2 className="font-semibold">Source: {report.usesHistory ? 'Recorded Usage History' : 'Formula Estimate'}</h2>
        <p className="mt-1 text-sm">
          {report.usesHistory
            ? `${report.observedDays} of ${period} days have user-entered or persisted observations. Totals include only those recorded days; missing days were not filled. Recorded does not imply meter or sensor data.`
            : `No observations exist in this window. This fallback multiplies the current daily Formula Estimate by ${period} days.`}
        </p>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card"><p className="text-sm text-gray-500">Energy</p><p className="mt-1 text-2xl font-semibold">{report.kwh.toFixed(2)} kWh</p></div>
        <div className="card"><p className="text-sm text-gray-500">Cost</p><p className="mt-1 text-2xl font-semibold">{formatCost(report.cost)}</p></div>
        <div className="card"><p className="text-sm text-gray-500">Estimated emissions</p><p className="mt-1 text-2xl font-semibold">{report.carbonKg.toFixed(2)} kg CO₂</p></div>
        <div className="card"><p className="text-sm text-gray-500">Observed coverage</p><p className="mt-1 text-2xl font-semibold">{report.observedDays}/{period} days</p></div>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Calculation Settings</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-gray-500">Currency</dt><dd className="font-medium">{settings.currency}</dd></div>
          <div><dt className="text-gray-500">Electricity rate</dt><dd className="font-medium">{formatCost(settings.electricityRate)}/kWh</dd></div>
          <div><dt className="text-gray-500">Carbon factor</dt><dd className="font-medium">{CARBON_KG_PER_KWH} kg CO₂/kWh</dd></div>
        </dl>
        <p className="mt-3 text-xs text-gray-500">Emissions are estimates based on a national factor; regional electricity emissions vary.</p>
      </section>

      <section className="card">
        <h2 className="text-lg font-semibold">Included Active Appliances ({trackedAppliances.length})</h2>
        {trackedAppliances.length ? (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead><tr className="border-b"><th className="py-2">Appliance</th><th>Daily Formula Estimate</th><th>Note</th></tr></thead>
              <tbody>
                {trackedAppliances.map(appliance => (
                  <tr key={appliance.id} className="border-b last:border-0">
                    <td className="py-2 font-medium">{appliance.name}</td>
                    <td>{getKwhPerDay(appliance).toFixed(3)} kWh</td>
                    <td>{appliance.isSample ? 'Sample data' : appliance.estimatedDailyKWh != null ? 'Manual daily override' : 'Entered schedule'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="mt-3 text-sm text-gray-500">No active appliances.</p>}
      </section>
    </article>
  );
}
