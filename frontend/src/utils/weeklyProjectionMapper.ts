export type WeeklyProjectionDTO = {
  date?: string
  weekStart?: string
  weekEnd?: string
  totalKwh?: number
  totalCost: number
}

function parseIsoDate(date: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!match) return null

  const [, year, month, day] = match
  const parsed = new Date(Number(year), Number(month) - 1, Number(day))
  parsed.setHours(0, 0, 0, 0)

  if (Number.isNaN(parsed.getTime())) return null
  if (
    parsed.getFullYear() !== Number(year) ||
    parsed.getMonth() !== Number(month) - 1 ||
    parsed.getDate() !== Number(day)
  ) {
    return null
  }

  return parsed
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function normalizeToMondayKey(date: string): string | null {
  const parsed = parseIsoDate(date)
  if (!parsed) return null

  const dayOfWeek = parsed.getDay() // 0 = Sunday, 1 = Monday, ...
  const daysSinceMonday = (dayOfWeek + 6) % 7
  parsed.setDate(parsed.getDate() - daysSinceMonday)

  return toIsoDate(parsed)
}

export function toWeeklyProjectionMap(
  projections: WeeklyProjectionDTO[]
): Map<string, number> {
  const map = new Map<string, number>()

  for (const projection of projections) {
    if (!projection.weekStart) continue

    const weekStartKey = normalizeToMondayKey(projection.weekStart)
    if (!weekStartKey) continue

    if (Number.isFinite(projection.totalCost)) {
      map.set(weekStartKey, projection.totalCost)
    }
  }

  return map
}

export function toWeeklyProjectionKwhMap(projections: WeeklyProjectionDTO[]): Map<string, number> {
  const map = new Map<string, number>()

  for (const projection of projections) {
    if (!projection.weekStart) continue

    const weekStartKey = normalizeToMondayKey(projection.weekStart)
    if (!weekStartKey) continue

    const kwh = projection.totalKwh
    if (typeof kwh === 'number' && Number.isFinite(kwh)) {
      map.set(weekStartKey, kwh)
    }
  }

  return map
}
