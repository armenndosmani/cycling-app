/**
 * What a ride shows, decided without React so it can be tested: list order and labels,
 * distance wording, the meeting point (exact or generalised) and the admin's actions.
 */
import type { LatLon, LineString } from '@/api/routes';
import type { Ride, RideStatus, RideSummary, ViewerRole } from '@/api/rides';

// --- My rides list ---

/** Marker shown next to a ride in lists; never only a colour. */
export type RideBadge = 'draft' | 'cancelled' | 'past';

export function rideBadge(ride: Pick<RideSummary, 'status' | 'past'>): RideBadge | null {
  if (ride.status === 'CANCELLED') return 'cancelled';
  if (ride.past) return 'past';
  if (ride.status === 'DRAFT') return 'draft';
  return null;
}

/** Upcoming: not past and not cancelled (drafts included). */
export function isUpcoming(ride: Pick<RideSummary, 'status' | 'past'>): boolean {
  return ride.status !== 'CANCELLED' && !ride.past;
}

function startOf(ride: Pick<RideSummary, 'startsAt'>): number | null {
  if (!ride.startsAt) return null;
  const time = Date.parse(ride.startsAt);
  return Number.isNaN(time) ? null : time;
}

/**
 * Upcoming rides first, soonest first, drafts without a start at the end of them; then past
 * and cancelled rides, most recent first. Stable for equal starts.
 */
export function sortRides<T extends Pick<RideSummary, 'status' | 'past' | 'startsAt'>>(
  rides: readonly T[],
): T[] {
  const upcoming = rides.filter(isUpcoming);
  const ended = rides.filter((ride) => !isUpcoming(ride));
  const ascending = (a: T, b: T) => {
    const sa = startOf(a);
    const sb = startOf(b);
    if (sa === sb) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sa - sb;
  };
  const descending = (a: T, b: T) => {
    const sa = startOf(a);
    const sb = startOf(b);
    if (sa === sb) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa;
  };
  return [...[...upcoming].sort(ascending), ...[...ended].sort(descending)];
}

// --- Distance ---

/**
 * A calculated distance comes from the ride's route copy. A planned one is the admin's target
 * and is always worded "about … (planned)", never as a route result.
 */
export type DistanceDisplay =
  { kind: 'calculated'; meters: number } | { kind: 'planned'; km: number } | { kind: 'none' };

export function distanceDisplay(
  ride: Pick<RideSummary, 'distanceMeters' | 'distanceIsPlanned' | 'targetDistanceKm'>,
): DistanceDisplay {
  if (!ride.distanceIsPlanned && ride.distanceMeters !== null) {
    return { kind: 'calculated', meters: ride.distanceMeters };
  }
  const km =
    ride.targetDistanceKm ?? (ride.distanceMeters !== null ? ride.distanceMeters / 1000 : null);
  return km === null ? { kind: 'none' } : { kind: 'planned', km: Math.round(km) };
}

// --- Meeting point and route on the map ---

export type MeetingDisplay =
  | { kind: 'exact'; point: LatLon }
  | { kind: 'area'; center: LatLon; radiusMeters: number }
  | { kind: 'none' };

/** Admin and participants may see exact data; everyone else only the generalised area. */
export function seesExactLocation(role: ViewerRole): boolean {
  return role === 'ADMIN' || role === 'PARTICIPANT';
}

/**
 * The exact point only for the admin and participants. Others get the circle, never the
 * point, even if one were sent by mistake (the backend must not send it at all).
 */
export function meetingDisplay(
  ride: Pick<Ride, 'viewerRole' | 'meetingPoint' | 'meetingArea'>,
): MeetingDisplay {
  if (seesExactLocation(ride.viewerRole) && ride.meetingPoint) {
    return { kind: 'exact', point: ride.meetingPoint };
  }
  if (ride.meetingArea) {
    const { lat, lon, radiusMeters } = ride.meetingArea;
    return { kind: 'area', center: { lat, lon }, radiusMeters };
  }
  return { kind: 'none' };
}

/** The route line only for the admin and participants. */
export function visibleRoute(ride: Pick<Ride, 'viewerRole' | 'routeGeometry'>): LineString | null {
  return seesExactLocation(ride.viewerRole) ? ride.routeGeometry : null;
}

const EARTH_RADIUS_METERS = 6_371_008.8;

/**
 * A closed GeoJSON ring approximating a circle on the ground, as [lon, lat] positions. A map
 * circle layer is sized in pixels, so the area is drawn as a polygon instead.
 */
export function circleRing(center: LatLon, radiusMeters: number, steps = 64): [number, number][] {
  const lat = (center.lat * Math.PI) / 180;
  const lon = (center.lon * Math.PI) / 180;
  const angular = radiusMeters / EARTH_RADIUS_METERS;
  const ring: [number, number][] = [];
  for (let i = 0; i < steps; i += 1) {
    const bearing = (2 * Math.PI * i) / steps;
    const pointLat = Math.asin(
      Math.sin(lat) * Math.cos(angular) + Math.cos(lat) * Math.sin(angular) * Math.cos(bearing),
    );
    const pointLon =
      lon +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angular) * Math.cos(lat),
        Math.cos(angular) - Math.sin(lat) * Math.sin(pointLat),
      );
    ring.push([(pointLon * 180) / Math.PI, (pointLat * 180) / Math.PI]);
  }
  ring.push(ring[0]);
  return ring;
}

// --- Admin actions ---

export type AdminActions = {
  edit: boolean;
  publish: boolean;
  cancel: boolean;
  delete: boolean;
};

/** What the admin may do now; the backend enforces the same rules. */
export function adminActions(ride: Pick<Ride, 'viewerRole' | 'status' | 'past'>): AdminActions {
  const admin = ride.viewerRole === 'ADMIN';
  const open = admin && ride.status !== 'CANCELLED' && !ride.past;
  const status: RideStatus = ride.status;
  return {
    edit: open,
    publish: open && status === 'DRAFT',
    cancel: open && status === 'PUBLISHED',
    delete: admin && status === 'DRAFT',
  };
}
