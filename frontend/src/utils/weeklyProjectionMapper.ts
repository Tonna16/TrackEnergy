export type WeeklyProjectionDTO = {
  date?: string
  weekStart?: string
  weekEnd?: string
  totalCost: number
}

export function toWeeklyProjectionMap(
  projections: WeeklyProjectionDTO[],
  convertCurrency: (value: number) => number
): Map<string, number> {
  const map = new Map<string, number>()

  for (const projection of projections) {
    const weekStart = projection.weekStart
    if (!weekStart) continue

    const raw = projection.totalCost
    const converted = Number.isFinite(raw) ? convertCurrency(raw) : NaN

    if (Number.isFinite(converted)) {
      map.set(weekStart, converted)
    }
  }

  return map
}
