import { useMemo, useState, type FormEvent } from 'react';
import { CalendarDays, Pencil, Trash2 } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { usageHistoryId, type UsageHistoryEntry } from '../types';

const todayString = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export default function UsageHistory() {
  const {
    appliances,
    trackedAppliances,
    historyEntries,
    upsertHistoryEntry,
    deleteHistoryEntry,
    historyStatus,
  } = useAppContext();
  const [date, setDate] = useState(todayString);
  const [scope, setScope] = useState<'household' | 'appliance'>('household');
  const [applianceId, setApplianceId] = useState<number | ''>(trackedAppliances[0]?.id ?? '');
  const [kwh, setKwh] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const applianceNames = useMemo(
    () => new Map(appliances.map(appliance => [appliance.id, appliance.name])),
    [appliances],
  );
  const displayed = showAll ? historyEntries : historyEntries.slice(0, 100);

  const resetForm = () => {
    setDate(todayString());
    setScope('household');
    setApplianceId(trackedAppliances[0]?.id ?? '');
    setKwh('');
    setEditingId(null);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const value = Number(kwh);
    const saved = upsertHistoryEntry({
      date,
      scope,
      applianceId: scope === 'appliance' && applianceId !== '' ? applianceId : undefined,
      kwh: value,
      isSample: false,
    });
    if (!saved) {
      setMessage('Enter a valid date that is not in the future, a valid scope, and a non-negative kWh value.');
      return;
    }
    const savedId = usageHistoryId(date, scope, scope === 'appliance' ? applianceId || undefined : undefined);
    if (editingId && editingId !== savedId) deleteHistoryEntry(editingId);
    setMessage(editingId ? 'Usage entry updated.' : 'Usage entry saved locally.');
    resetForm();
  };

  const edit = (entry: UsageHistoryEntry) => {
    setDate(entry.date);
    setScope(entry.scope);
    setApplianceId(entry.applianceId ?? '');
    setKwh(String(entry.kwh));
    setEditingId(entry.id);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const remove = (entry: UsageHistoryEntry) => {
    if (!window.confirm(`Delete the ${entry.date} usage entry?`)) return;
    deleteHistoryEntry(entry.id);
    if (editingId === entry.id) resetForm();
  };

  return (
    <div className="space-y-6 pb-16 sm:pb-0">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <CalendarDays className="h-6 w-6 text-emerald-600" /> Usage History
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Entries stay in this browser. Formula Projections remain separate from History-Based Forecasts.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="card md:col-span-2">
          <h2 className="text-lg font-semibold">{editingId ? 'Edit daily usage' : 'Enter daily usage'}</h2>
          <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              Date
              <input
                aria-label="Usage date"
                type="date"
                max={todayString()}
                value={date}
                onChange={event => setDate(event.target.value)}
                required
                className="rounded-md border px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Scope
              <select
                aria-label="Usage scope"
                value={scope}
                onChange={event => setScope(event.target.value as 'household' | 'appliance')}
                className="rounded-md border px-3 py-2"
              >
                <option value="household">Household total</option>
                <option value="appliance" disabled={!trackedAppliances.length}>Specific appliance</option>
              </select>
            </label>
            {scope === 'appliance' && (
              <label className="flex flex-col gap-1 text-sm">
                Appliance
                <select
                  aria-label="Usage appliance"
                  value={applianceId}
                  onChange={event => setApplianceId(Number(event.target.value))}
                  required
                  className="rounded-md border px-3 py-2"
                >
                  {trackedAppliances.map(appliance => (
                    <option key={appliance.id} value={appliance.id}>{appliance.name}</option>
                  ))}
                </select>
              </label>
            )}
            <label className="flex flex-col gap-1 text-sm">
              Energy used (kWh)
              <input
                aria-label="Energy used in kWh"
                type="number"
                min="0"
                step="0.001"
                value={kwh}
                onChange={event => setKwh(event.target.value)}
                required
                className="rounded-md border px-3 py-2"
              />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button type="submit" className="btn btn-primary">{editingId ? 'Update Entry' : 'Save Entry'}</button>
              {editingId && <button type="button" className="btn btn-outline" onClick={resetForm}>Cancel</button>}
            </div>
          </form>
          {message && <p role="status" className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
          <p className="mt-3 text-xs text-gray-500">
            A household total overrides summed appliance entries for that date. Today may be recorded, but forecasting and printable reports use completed days through yesterday.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold">Forecast readiness</h2>
          <p className="mt-3 text-3xl font-bold text-emerald-600">{historyStatus.recentHistoryDays}/60</p>
          <p className="text-sm text-gray-500">latest completed days recorded</p>
          <p className="mt-3 text-sm">
            {historyStatus.available
              ? `${historyStatus.dataCoverage} · ${historyStatus.granularity} history. Coverage does not measure forecast accuracy.`
              : 'Record each of the latest 60 completed days to unlock the separate History-Based Forecast.'}
          </p>
          {historyEntries.some(entry => entry.isSample) && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
              Sample history is illustrative—not measured usage.
            </p>
          )}
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Recorded entries</h2>
            <p className="text-sm text-gray-500">Showing {displayed.length} of {historyEntries.length} entries</p>
          </div>
          {historyEntries.length > 100 && (
            <button className="btn btn-outline" onClick={() => setShowAll(value => !value)}>
              {showAll ? 'Show Latest 100' : 'Show All'}
            </button>
          )}
        </div>
        {displayed.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b text-xs uppercase text-gray-500">
                <tr><th className="py-2 pr-4">Date</th><th className="py-2 pr-4">Scope</th><th className="py-2 pr-4">kWh</th><th className="py-2 text-right">Actions</th></tr>
              </thead>
              <tbody>
                {displayed.map(entry => (
                  <tr key={entry.id} className="border-b border-gray-100 dark:border-gray-800">
                    <td className="py-3 pr-4">{entry.date}</td>
                    <td className="py-3 pr-4">
                      {entry.scope === 'household'
                        ? 'Household total'
                        : applianceNames.get(entry.applianceId ?? Number.NaN) ?? `Removed appliance #${entry.applianceId}`}
                      {entry.isSample && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Sample</span>}
                    </td>
                    <td className="py-3 pr-4">{entry.kwh.toFixed(3)}</td>
                    <td className="py-3 text-right">
                      <button aria-label={`Edit usage for ${entry.date}`} className="mr-2 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => edit(entry)}><Pencil size={16} /></button>
                      <button aria-label={`Delete usage for ${entry.date}`} className="rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={() => remove(entry)}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 rounded-lg bg-gray-50 p-6 text-center text-gray-500 dark:bg-gray-900">No usage history recorded yet.</p>
        )}
      </div>
    </div>
  );
}
