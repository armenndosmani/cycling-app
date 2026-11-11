import type { ProfilePoint } from '@/api/routes';

/**
 * Reduces a long elevation profile to at most `maxPoints` points for drawing. Each bucket keeps
 * its lowest and highest point (in distance order), so climbs and peaks stay visible.
 */
export function downsampleProfile(profile: ProfilePoint[], maxPoints: number): ProfilePoint[] {
  if (profile.length <= maxPoints || maxPoints < 4) return profile;
  const first = profile[0];
  const last = profile[profile.length - 1];
  const inner = profile.slice(1, -1);
  const bucketCount = Math.floor((maxPoints - 2) / 2);
  const bucketSize = inner.length / bucketCount;

  const result: ProfilePoint[] = [first];
  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const slice = inner.slice(
      Math.floor(bucket * bucketSize),
      Math.floor((bucket + 1) * bucketSize),
    );
    if (slice.length === 0) continue;
    let low = slice[0];
    let high = slice[0];
    for (const point of slice) {
      if (point[1] < low[1]) low = point;
      if (point[1] > high[1]) high = point;
    }
    if (low === high) result.push(low);
    else result.push(...(low[0] <= high[0] ? [low, high] : [high, low]));
  }
  result.push(last);
  return result;
}

export type ProfileChart = {
  /** SVG path of the elevation line */
  line: string;
  /** SVG path of the filled area under the line */
  area: string;
  minElevation: number;
  maxElevation: number;
  totalDistance: number;
};

export type ChartBox = { width: number; height: number; padding: number };

/** SVG paths for the profile inside the box. Null when there is nothing to draw. */
export function profileChart(profile: ProfilePoint[], box: ChartBox): ProfileChart | null {
  if (profile.length < 2 || box.width <= 0 || box.height <= 0) return null;
  const totalDistance = profile[profile.length - 1][0] - profile[0][0];
  if (!(totalDistance > 0)) return null;

  let minElevation = Infinity;
  let maxElevation = -Infinity;
  for (const [, elevation] of profile) {
    minElevation = Math.min(minElevation, elevation);
    maxElevation = Math.max(maxElevation, elevation);
  }
  // Flat routes still get some vertical room
  const range = Math.max(maxElevation - minElevation, 10);
  const innerHeight = box.height - 2 * box.padding;
  const x = (distance: number) => ((distance - profile[0][0]) / totalDistance) * box.width;
  const y = (elevation: number) =>
    box.padding + innerHeight - ((elevation - minElevation) / range) * innerHeight;

  const commands = profile.map(
    ([distance, elevation], i) =>
      `${i === 0 ? 'M' : 'L'}${round(x(distance))},${round(y(elevation))}`,
  );
  const line = commands.join(' ');
  const area = `${line} L${round(box.width)},${round(box.height)} L0,${round(box.height)} Z`;
  return { line, area, minElevation, maxElevation, totalDistance };
}

/** Index of the profile point closest to `distance` (profile sorted by distance). */
export function nearestProfileIndex(profile: ProfilePoint[], distance: number): number {
  if (profile.length === 0) return -1;
  let low = 0;
  let high = profile.length - 1;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (profile[mid][0] < distance) low = mid + 1;
    else high = mid;
  }
  if (low > 0 && distance - profile[low - 1][0] <= profile[low][0] - distance) return low - 1;
  return low;
}

/** Distance along the profile for a touch at `x` of a chart `width` wide. */
export function distanceAtX(profile: ProfilePoint[], x: number, width: number): number {
  if (profile.length === 0 || width <= 0) return 0;
  const start = profile[0][0];
  const end = profile[profile.length - 1][0];
  const fraction = Math.min(1, Math.max(0, x / width));
  return start + fraction * (end - start);
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
