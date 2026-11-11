import type { Position } from '@/api/routes';

const EARTH_RADIUS_METERS = 6_371_008.8;

type LonLat = readonly [number, number, ...number[]];

/** Great-circle distance in metres between two [lon, lat] positions. */
export function haversineMeters(a: LonLat, b: LonLat): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * The [lon, lat] position at `fraction` (0..1) of the line's length. Used to mark a point of
 * the elevation profile on the map; the fraction avoids depending on how the backend measured
 * distances.
 */
export function positionAtFraction(
  coordinates: Position[],
  fraction: number,
): [number, number] | null {
  if (coordinates.length === 0) return null;
  const first = coordinates[0];
  if (coordinates.length === 1 || !(fraction > 0)) return [first[0], first[1]];

  const segments: number[] = [];
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    const length = haversineMeters(coordinates[i - 1], coordinates[i]);
    segments.push(length);
    total += length;
  }
  const last = coordinates[coordinates.length - 1];
  if (total === 0 || fraction >= 1) return [last[0], last[1]];

  let remaining = fraction * total;
  for (let i = 0; i < segments.length; i += 1) {
    if (remaining <= segments[i]) {
      const t = segments[i] === 0 ? 0 : remaining / segments[i];
      const a = coordinates[i];
      const b = coordinates[i + 1];
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    remaining -= segments[i];
  }
  return [last[0], last[1]];
}

/** [west, south, east, north] around the positions, or null for none. */
export function boundsOf(
  coordinates: readonly LonLat[],
): [west: number, south: number, east: number, north: number] | null {
  if (coordinates.length === 0) return null;
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  for (const [lon, lat] of coordinates) {
    west = Math.min(west, lon);
    east = Math.max(east, lon);
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  return [west, south, east, north];
}
