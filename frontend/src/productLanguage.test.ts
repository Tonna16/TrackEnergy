import { describe, expect, it } from 'vitest';
import metadata from '../index.html?raw';

describe('public product metadata', () => {
  it('describes EnergyIQ as an estimator and planning tool', () => {
    expect(metadata).toContain('EnergyIQ — Household Energy Estimator &amp; Planning Tool');
    expect(metadata).toContain('appliance schedules');
    expect(metadata).toContain('illustrative references');
  });

  it('does not claim tracking, monitoring, live data, rankings, or comparison with other people', () => {
    expect(metadata).not.toMatch(/\btrack(?:ing)?\b|\bmonitor(?:ing)?\b|\blive\b|Top 40%|your area|compare with others/i);
  });
});
