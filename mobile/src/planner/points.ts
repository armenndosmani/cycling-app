import type { Discipline, LatLon } from '@/api/routes';
import { haversineMeters } from '@/planner/geo';

/** Waypoints between start and destination (proposed limit in the spec). */
export const MAX_WAYPOINTS = 25;

export type RoutePoint = LatLon & {
  /** Stable id for markers, list rows and drag targets */
  id: string;
  /** Place name when the point came from place search */
  name?: string;
};

/** The rider's points. Immutable: every operation returns a new object. */
export type RoutePoints = {
  start: RoutePoint | null;
  waypoints: RoutePoint[];
  destination: RoutePoint | null;
};

export type PointRole = 'start' | 'waypoint' | 'destination';

export type ListedPoint = {
  point: RoutePoint;
  role: PointRole;
  /** 0-based index among the waypoints; 0 for start and destination */
  index: number;
};

export type EditResult = { ok: true; points: RoutePoints } | { ok: false; reason: 'waypointLimit' };

export const EMPTY_POINTS: RoutePoints = { start: null, waypoints: [], destination: null };

let nextId = 0;

export function createPoint(position: LatLon, name?: string): RoutePoint {
  nextId += 1;
  return { id: `p${nextId}`, lat: position.lat, lon: position.lon, ...(name ? { name } : {}) };
}

const ok = (points: RoutePoints): EditResult => ({ ok: true, points });

/**
 * Adds a point where the rider expects it: the start first, then the destination, then a
 * waypoint at the position that changes the route least.
 */
export function addPoint(points: RoutePoints, point: RoutePoint): EditResult {
  if (!points.start) return ok({ ...points, start: point });
  if (!points.destination) return ok({ ...points, destination: point });
  return insertWaypoint(points, point);
}

/**
 * Inserts a waypoint at `index` among the waypoints, or, without an index, between the two
 * neighbouring points where it adds the least straight-line detour.
 */
export function insertWaypoint(points: RoutePoints, point: RoutePoint, index?: number): EditResult {
  if (points.waypoints.length >= MAX_WAYPOINTS) return { ok: false, reason: 'waypointLimit' };
  const at = clamp(index ?? bestInsertIndex(points, point), 0, points.waypoints.length);
  const waypoints = [...points.waypoints];
  waypoints.splice(at, 0, point);
  return ok({ ...points, waypoints });
}

/** Index among the waypoints where inserting `point` adds the least detour. */
export function bestInsertIndex(points: RoutePoints, point: LatLon): number {
  const chain = chainOf(points);
  if (chain.length === 0) return 0;
  // Index among the waypoints for "right after chain[i]"
  const afterChain = (i: number) => (points.start ? i : i + 1);
  // An open end (no start or no destination yet) can be extended without any detour
  let best = points.destination ? -1 : points.waypoints.length;
  let bestCost = points.destination ? Infinity : distance(chain[chain.length - 1], point);
  if (!points.start) {
    const cost = distance(point, chain[0]);
    if (cost < bestCost) {
      bestCost = cost;
      best = 0;
    }
  }
  for (let i = 0; i < chain.length - 1; i += 1) {
    const a = chain[i];
    const b = chain[i + 1];
    const cost = distance(a, point) + distance(point, b) - distance(a, b);
    if (cost < bestCost) {
      bestCost = cost;
      best = afterChain(i);
    }
  }
  return Math.max(0, best);
}

/** Moves any point to a new position (e.g. after dragging its marker). */
export function movePoint(points: RoutePoints, id: string, position: LatLon): RoutePoints {
  const moved = (point: RoutePoint): RoutePoint => ({ id: point.id, ...pick(position) });
  return {
    start: points.start?.id === id ? moved(points.start) : points.start,
    waypoints: points.waypoints.map((point) => (point.id === id ? moved(point) : point)),
    destination: points.destination?.id === id ? moved(points.destination) : points.destination,
  };
}

/** Removes a point. Removing the start or destination leaves that slot empty. */
export function removePoint(points: RoutePoints, id: string): RoutePoints {
  return {
    start: points.start?.id === id ? null : points.start,
    waypoints: points.waypoints.filter((point) => point.id !== id),
    destination: points.destination?.id === id ? null : points.destination,
  };
}

/** Moves a waypoint one place earlier (-1) or later (+1) in the order. */
export function reorderWaypoint(points: RoutePoints, id: string, direction: -1 | 1): RoutePoints {
  const from = points.waypoints.findIndex((point) => point.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= points.waypoints.length) return points;
  const waypoints = [...points.waypoints];
  [waypoints[from], waypoints[to]] = [waypoints[to], waypoints[from]];
  return { ...points, waypoints };
}

/** Sets the destination to the start, so the route is a loop. */
export function makeLoop(points: RoutePoints): RoutePoints {
  if (!points.start) return points;
  const { lat, lon, name } = points.start;
  return { ...points, destination: createPoint({ lat, lon }, name) };
}

/** Points in route order with their role, for the list and the markers. */
export function listPoints(points: RoutePoints): ListedPoint[] {
  const listed: ListedPoint[] = [];
  if (points.start) listed.push({ point: points.start, role: 'start', index: 0 });
  points.waypoints.forEach((point, index) => listed.push({ point, role: 'waypoint', index }));
  if (points.destination) {
    listed.push({ point: points.destination, role: 'destination', index: 0 });
  }
  return listed;
}

/** The points to send for routing, or null until start and destination are set. */
export function routeRequestPoints(points: RoutePoints): LatLon[] | null {
  if (!points.start || !points.destination) return null;
  return [points.start, ...points.waypoints, points.destination].map(pick);
}

/** Identifies a routing request, so a result can be matched to the points it belongs to. */
export function routeKey(points: RoutePoints, discipline: Discipline): string | null {
  const request = routeRequestPoints(points);
  if (!request) return null;
  return `${discipline}|${request.map(({ lat, lon }) => `${lat},${lon}`).join(';')}`;
}

/** Points of a saved route: first is the start, last the destination. */
export function pointsFromList(list: LatLon[]): RoutePoints {
  if (list.length < 2) return EMPTY_POINTS;
  return {
    start: createPoint(list[0]),
    waypoints: list.slice(1, -1).map((point) => createPoint(point)),
    destination: createPoint(list[list.length - 1]),
  };
}

function chainOf(points: RoutePoints): LatLon[] {
  return [points.start, ...points.waypoints, points.destination].filter(
    (point): point is RoutePoint => point !== null,
  );
}

function distance(a: LatLon, b: LatLon): number {
  return haversineMeters([a.lon, a.lat], [b.lon, b.lat]);
}

function pick({ lat, lon }: LatLon): LatLon {
  return { lat, lon };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
