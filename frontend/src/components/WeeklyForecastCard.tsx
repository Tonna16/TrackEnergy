import { useEffect, useMemo, useState } from 'react';
import api from '../utils/api';
import { getAuthToken } from '../utils/auth';
import { useAppContext } from '../context/AppContext';
import { getKwhPerDay } from '../utils/energyCalculations';

type ProjectionDTO = {
  weekStart?: string;
  weekEnd?: string;
  totalKwh: number;
  totalCost: number;
  source?: string;
};

const isoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const nextMonday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + (((8 - date.getDay()) % 7) || 7));
  return date;
};

export default function WeeklyProjectionCard() {
  const { trackedAppliances, costFromKwh, formatCost, backendEnabled } = useAppContext();
  const [serverProjection, setServerProjection] = useState<ProjectionDTO | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!backendEnabled || !getAuthToken()) {
      setServerProjection(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api.get<ProjectionDTO[]>('energy-usage/projections', { params: { timeRange: 'weekly' } })
      .then(response => {
        if (!cancelled) setServerProjection(Array.isArray(response.data) ? response.data[0] ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setServerProjection(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [backendEnabled, trackedAppliances]);

  const formula = useMemo(() => {
    const start = nextMonday();
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const totalKwh = trackedAppliances.reduce((sum, appliance) => sum + getKwhPerDay(appliance) * 7, 0);
    return {
      weekStart: isoDate(start),
      weekEnd: isoDate(end),
      totalKwh,
      totalCost: costFromKwh(totalKwh),
    };
  }, [costFromKwh, trackedAppliances]);

  const projection = serverProjection ?? formula;

  return (
    <div className="card p-4 bg-white dark:bg-gray-800 border rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-medium">Next Week Formula Projection</h3>
        <div className="text-xs text-gray-500">Next Monday through Sunday</div>
      </div>
      {loading ? (
        <div className="py-6 text-center text-sm text-gray-500">Loading weekly projection…</div>
      ) : (
        <div className="flex justify-between items-center py-2">
          <div>
            <div className="font-medium">{projection.weekStart} → {projection.weekEnd}</div>
            <div className="text-xs text-gray-500">{projection.totalKwh.toFixed(2)} kWh · Formula Projection</div>
          </div>
          <div className="text-right">
            <div className="font-semibold">{formatCost(projection.totalCost)}</div>
            <div className="text-xs text-gray-500">Estimated weekly cost</div>
          </div>
        </div>
      )}
    </div>
  );
}
