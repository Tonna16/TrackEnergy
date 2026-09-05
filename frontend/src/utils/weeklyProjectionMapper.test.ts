import { describe, expect, it } from 'vitest';
import {
  normalizeToMondayKey,
  toWeeklyProjectionKwhMap,
  toWeeklyProjectionMap,
} from './weeklyProjectionMapper';

describe('weekly projection mapping', () => {
  const projections = [{
    date: '2026-04-20',
    weekStart: '2026-04-20',
    weekEnd: '2026-04-26',
    totalKwh: 52,
    totalCost: 25,
  }];

  it('normalizes every date in a week to its Monday', () => {
    expect(normalizeToMondayKey('2026-04-20')).toBe('2026-04-20');
    expect(normalizeToMondayKey('2026-04-22')).toBe('2026-04-20');
    expect(normalizeToMondayKey('invalid')).toBeNull();
  });

  it('maps server cost directly without currency conversion', () => {
    expect(toWeeklyProjectionMap(projections).get('2026-04-20')).toBe(25);
  });

  it('maps weekly kWh to the same Monday key', () => {
    expect(toWeeklyProjectionKwhMap(projections).get('2026-04-20')).toBe(52);
  });
});
