import type { SurfaceShare } from '@/api/routes';

/** Surface groups the app has a translated name for (`planner.surfaces.<key>`). */
export const SURFACE_KEYS = [
  'asphalt',
  'concrete',
  'paving_stones',
  'cobblestone',
  'compacted',
  'fine_gravel',
  'gravel',
  'unpaved',
  'ground',
  'dirt',
  'grass',
  'sand',
  'wood',
  'other',
  'unknown',
] as const;

export type SurfaceKey = (typeof SURFACE_KEYS)[number];

export type SurfacePercentage = { surface: SurfaceKey; percent: number };

/** Maps a surface value from the routing data (OSM `surface`) to a group with a translated name. */
export function surfaceKey(raw: string): SurfaceKey {
  const value = raw
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  if (value === '' || value === 'missing' || value === 'unknown' || value === 'null') {
    return 'unknown';
  }
  if (value === 'paved') return 'asphalt';
  if (value === 'sett' || value === 'unhewn_cobblestone') return 'cobblestone';
  if (value === 'pebblestone') return 'gravel';
  if (value === 'earth' || value === 'mud') return 'dirt';
  return (SURFACE_KEYS as readonly string[]).includes(value) ? (value as SurfaceKey) : 'other';
}

/**
 * Whole percentages per surface group, largest first, summing to exactly 100 (largest
 * remainder method). A very small group can show as 0 %.
 */
export function surfacePercentages(surfaces: SurfaceShare[]): SurfacePercentage[] {
  const totals = new Map<SurfaceKey, number>();
  for (const { surface, meters } of surfaces) {
    if (!(meters > 0)) continue;
    const key = surfaceKey(surface);
    totals.set(key, (totals.get(key) ?? 0) + meters);
  }
  const total = [...totals.values()].reduce((sum, meters) => sum + meters, 0);
  if (total === 0) return [];

  const shares = [...totals.entries()].map(([surface, meters]) => {
    const exact = (meters / total) * 100;
    return { surface, exact, percent: Math.floor(exact) };
  });
  let missing = 100 - shares.reduce((sum, share) => sum + share.percent, 0);
  for (const share of [...shares].sort((a, b) => b.exact - b.percent - (a.exact - a.percent))) {
    if (missing <= 0) break;
    share.percent += 1;
    missing -= 1;
  }
  return shares
    .sort((a, b) => b.exact - a.exact)
    .map(({ surface, percent }) => ({ surface, percent }));
}
