import { describe, expect, it } from 'vitest';

import { formatKilometres, roundMeters } from '@/planner/format';
import { surfaceKey, surfacePercentages } from '@/planner/surfaces';

describe('formatting', () => {
  it('shows kilometres with one decimal', () => {
    expect(formatKilometres(42_315)).toBe('42.3');
    expect(formatKilometres(42_350)).toBe('42.4');
    expect(formatKilometres(999)).toBe('1.0');
    expect(formatKilometres(0)).toBe('0.0');
    expect(formatKilometres(-5)).toBe('0.0');
  });

  it('rounds metres to whole numbers', () => {
    expect(roundMeters(512.4)).toBe(512);
    expect(roundMeters(512.5)).toBe(513);
  });
});

describe('surfaces', () => {
  it('maps raw values to known groups', () => {
    expect(surfaceKey('ASPHALT')).toBe('asphalt');
    expect(surfaceKey('fine-gravel')).toBe('fine_gravel');
    expect(surfaceKey('missing')).toBe('unknown');
    expect(surfaceKey('')).toBe('unknown');
    expect(surfaceKey('sett')).toBe('cobblestone');
    expect(surfaceKey('something_new')).toBe('other');
  });

  it('gives whole percentages that add up to 100, largest first', () => {
    const result = surfacePercentages([
      { surface: 'asphalt', meters: 1000 },
      { surface: 'gravel', meters: 1000 },
      { surface: 'unpaved', meters: 1000 },
    ]);
    expect(result.map((r) => r.percent).reduce((a, b) => a + b)).toBe(100);
    expect(result).toHaveLength(3);
    expect(result.map((r) => r.percent).sort()).toEqual([33, 33, 34]);
  });

  it('merges duplicate groups and skips empty ones', () => {
    expect(
      surfacePercentages([
        { surface: 'asphalt', meters: 600 },
        { surface: 'missing', meters: 100 },
        { surface: 'unknown', meters: 300 },
        { surface: 'gravel', meters: 0 },
      ]),
    ).toEqual([
      { surface: 'asphalt', percent: 60 },
      { surface: 'unknown', percent: 40 },
    ]);
    expect(surfacePercentages([])).toEqual([]);
  });
});
