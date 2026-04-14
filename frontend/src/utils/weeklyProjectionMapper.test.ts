import {
  normalizeToMondayKey,
  toWeeklyProjectionKwhMap,
  toWeeklyProjectionMap,
} from './weeklyProjectionMapper'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`)
  }
}

function isoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function cardWeekAnchorKey(anchorIsoDate: string): string | null {
  const anchor = new Date(`${anchorIsoDate}T00:00:00`)
  anchor.setHours(0, 0, 0, 0)

  const day = anchor.getDay()
  const daysSinceMonday = (day + 6) % 7
  anchor.setDate(anchor.getDate() - daysSinceMonday)

  return normalizeToMondayKey(isoDate(anchor))
}

const projections = [
  {
    date: '2026-04-20',
    weekStart: '2026-04-20',
    weekEnd: '2026-04-26',
    totalKwh: 52,
    totalCost: 25,
  },
]

const projectionMap = toWeeklyProjectionMap(projections, value => value)
const projectionKwhMap = toWeeklyProjectionKwhMap(projections)

assertEqual(
  projectionMap.get('2026-04-20'),
  25,
  'toWeeklyProjectionMap should keep a known Monday weekStart keyed in yyyy-MM-dd'
)

assertEqual(
  projectionKwhMap.get('2026-04-20'),
  52,
  'toWeeklyProjectionKwhMap should keep weekly usage keyed by Monday weekStart'
)

const cardLookupKey = cardWeekAnchorKey('2026-04-22')
assertEqual(cardLookupKey, '2026-04-20', 'Card week anchoring should normalize to the same Monday key')

assertEqual(
  cardLookupKey ? projectionMap.get(cardLookupKey) : undefined,
  25,
  'Card lookup key should resolve the Monday weekStart projection cost'
)

assertEqual(
  cardLookupKey ? projectionKwhMap.get(cardLookupKey) : undefined,
  52,
  'Card lookup key should resolve the Monday weekStart projection kWh'
)
