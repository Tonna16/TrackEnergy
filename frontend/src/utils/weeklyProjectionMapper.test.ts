import { toWeeklyProjectionMap } from './weeklyProjectionMapper'

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`)
  }
}

const projections = [
  {
    date: '2026-04-20',
    weekStart: '2026-04-20',
    weekEnd: '2026-04-26',
    totalCost: 25,
  },
  {
    date: '2026-04-27',
    weekStart: '2026-04-27',
    weekEnd: '2026-05-03',
    totalCost: 30,
  },
]

const result = toWeeklyProjectionMap(projections, value => value)

assertEqual(result.get('2026-04-20'), 25, 'Week start should map to the matching projection cost')
