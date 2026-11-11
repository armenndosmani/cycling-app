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
  // A draft whose date has passed never took place: it stays a draft (and can be edited)
  if (ride.status === 'DRAFT') return 'draft';
  if (ride.past) return 'past';
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

// --- Places and admin ---

/**
 * Places of a ride. `taken` is the backend's `confirmedCount`: everyone holding a place, the
 * admin and riders who must reconfirm a moved start included.
 */
export type PlacesDisplay =
  | { kind: 'noLimit'; taken: number }
  | { kind: 'full'; limit: number }
  | { kind: 'left'; left: number; taken: number; limit: number };

export function placesDisplay(
  ride: Pick<RideSummary, 'confirmedCount' | 'participantLimit'> & { placesLeft?: number | null },
): PlacesDisplay {
  const taken = ride.confirmedCount;
  const limit = ride.participantLimit;
  // No limit yet (a draft): the backend sends placesLeft null
  if (limit === null) return { kind: 'noLimit', taken };
  const left = Math.max(0, ride.placesLeft ?? limit - taken);
  return left === 0 ? { kind: 'full', limit } : { kind: 'left', left, taken, limit };
}

/** The admin's name; null admin means the admin deleted their account. */
export type AdminDisplay =
  { kind: 'name'; name: string } | { kind: 'deleted' } | { kind: 'unnamed' };

export function adminDisplay(ride: Pick<Ride, 'admin'>): AdminDisplay {
  if (!ride.admin) return { kind: 'deleted' };
  const name = ride.admin.displayName.trim();
  return name ? { kind: 'name', name } : { kind: 'unnamed' };
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

/**
 * What the admin may do now; the backend enforces the same rules. Drafts can be edited
 * whatever their date (a past draft needs a new start before it can be published); published
 * rides only until they start; cancelled rides never.
 */
export function adminActions(ride: Pick<Ride, 'viewerRole' | 'status' | 'past'>): AdminActions {
  const admin = ride.viewerRole === 'ADMIN';
  const status: RideStatus = ride.status;
  const draft = admin && status === 'DRAFT';
  const upcomingPublished = admin && status === 'PUBLISHED' && !ride.past;
  return {
    edit: draft || upcomingPublished,
    publish: draft && !ride.past,
    cancel: upcomingPublished,
    delete: draft,
  };
}
