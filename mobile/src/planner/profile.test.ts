import { describe, expect, it } from 'vitest';

import type { Position, ProfilePoint } from '@/api/routes';
import { boundsOf, haversineMeters, positionAtFraction } from '@/planner/geo';
import {
  distanceAtX,
  downsampleProfile,
  nearestProfileIndex,
  profileChart,
} from '@/planner/profile';

const profile = (elevations: number[], step = 100): ProfilePoint[] =>
  elevations.map((elevation, i) => [i * step, elevation]);

describe('downsampleProfile', () => {
  it('keeps short profiles unchanged', () => {
    const short = profile([1, 2, 3]);
    expect(downsampleProfile(short, 10)).toBe(short);
  });

  it('reduces long profiles but keeps ends and the peak', () => {
    const elevations = Array.from({ length: 1000 }, (_, i) => (i === 437 ? 900 : 200 + (i % 7)));
    const long = profile(elevations);
    const reduced = downsampleProfile(long, 100);
    expect(reduced.length).toBeLessThanOrEqual(100);
    expect(reduced[0]).toBe(long[0]);
    expect(reduced[reduced.length - 1]).toBe(long[long.length - 1]);
    expect(reduced.some(([, elevation]) => elevation === 900)).toBe(true);
    const distances = reduced.map(([distance]) => distance);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });
});

describe('profileChart', () => {
  it('maps the profile into the box', () => {
    const chart = profileChart(profile([100, 200, 150]), { width: 200, height: 100, padding: 0 });
    expect(chart).not.toBeNull();
    expect(chart!.line).toBe('M0,100 L100,0 L200,50');
    expect(chart!.area).toBe('M0,100 L100,0 L200,50 L200,100 L0,100 Z');
    expect(chart!.minElevation).toBe(100);
    expect(chart!.maxElevation).toBe(200);
    expect(chart!.totalDistance).toBe(200);
  });

  it('returns null when there is nothing to draw', () => {
    expect(profileChart([], { width: 100, height: 50, padding: 0 })).toBeNull();
    expect(profileChart(profile([1]), { width: 100, height: 50, padding: 0 })).toBeNull();
  });
});

describe('profile lookup', () => {
  const points = profile([10, 20, 30, 40]);

  it('finds the nearest point by distance', () => {
    expect(nearestProfileIndex(points, -5)).toBe(0);
    expect(nearestProfileIndex(points, 140)).toBe(1);
    expect(nearestProfileIndex(points, 160)).toBe(2);
    expect(nearestProfileIndex(points, 1000)).toBe(3);
    expect(nearestProfileIndex([], 10)).toBe(-1);
  });

  it('converts a touch position to a distance', () => {
    expect(distanceAtX(points, 50, 100)).toBe(150);
    expect(distanceAtX(points, -10, 100)).toBe(0);
    expect(distanceAtX(points, 500, 100)).toBe(300);
  });
});

describe('geo', () => {
  it('measures distances', () => {
    // One degree of latitude is about 111 km
    expect(haversineMeters([0, 0], [0, 1])).toBeGreaterThan(111_000);
    expect(haversineMeters([0, 0], [0, 1])).toBeLessThan(111_400);
  });

  it('finds the position at a fraction of the line', () => {
    const line: Position[] = [
      [0, 0, 100],
      [0, 1, 120],
      [0, 3, 90],
    ];
    expect(positionAtFraction(line, 0)).toEqual([0, 0]);
    expect(positionAtFraction(line, 1)).toEqual([0, 3]);
    const middle = positionAtFraction(line, 0.5)!;
    expect(middle[0]).toBe(0);
    expect(middle[1]).toBeCloseTo(1.5, 3);
    expect(positionAtFraction([], 0.5)).toBeNull();
  });

  it('computes bounds', () => {
    expect(
      boundsOf([
        [1, 5],
        [-2, 7],
        [3, 4],
      ]),
    ).toEqual([-2, 4, 3, 7]);
    expect(boundsOf([])).toBeNull();
  });
});
