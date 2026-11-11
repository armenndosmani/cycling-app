/**
 * Route planner API contract (backend issue #38): route calculation, place search and saved
 * routes. All types and response parsing live here, so a change on the backend side only
 * needs changes in this file.
 */
import { ApiError } from '@/api/ApiError';
import type { RequestOptions } from '@/api/client';
import type { BicycleType } from '@/api/me';
import { PROBLEM_TYPES } from '@/api/problem';

/** Routing discipline; the same values as the bicycle types in the profile. */
export type Discipline = BicycleType;
// Repeated here (not imported from api/me) so this module stays free of the session
export const DISCIPLINES: readonly Discipline[] = ['ROAD', 'GRAVEL', 'MTB', 'URBAN'];

export type LatLon = { lat: number; lon: number };

/** Start, up to 25 waypoints, destination. The destination may equal the start (loop). */
export const MIN_ROUTE_POINTS = 2;
export const MAX_ROUTE_POINTS = 27;

export const ROUTE_NAME_MAX_LENGTH = 80;
export const ROUTE_NOTE_MAX_LENGTH = 1000;
export const PLACE_QUERY_MIN_LENGTH = 2;
export const PLACE_QUERY_MAX_LENGTH = 100;

/** [longitude, latitude] or [longitude, latitude, elevation] */
export type Position = [number, number] | [number, number, number];

export type LineString = { type: 'LineString'; coordinates: Position[] };

/** [distance from the start in metres, elevation in metres] */
export type ProfilePoint = [distanceMeters: number, elevationMeters: number];

export type SurfaceShare = { surface: string; meters: number };

/** A calculated route, as returned by `POST /api/routing/route`. */
export type CalculatedRoute = {
  geometry: LineString;
  distanceMeters: number;
  /** null where no elevation data exists for the area */
  ascendMeters: number | null;
  elevationProfile: ProfilePoint[];
  surfaces: SurfaceShare[];
};

export type Place = { name: string; label: string; lat: number; lon: number };

export type SavedRouteSummary = {
  id: string;
  name: string;
  discipline: Discipline;
  distanceMeters: number;
  ascendMeters: number | null;
  updatedAt: string;
};

export type SavedRoute = CalculatedRoute & {
  id: string;
  name: string;
  note: string | null;
  discipline: Discipline;
  points: LatLon[];
  createdAt: string;
  updatedAt: string;
};

export type SaveRouteBody = {
  name: string;
  note?: string;
  discipline: Discipline;
  points: LatLon[];
};

type Send = <T>(path: string, options?: RequestOptions) => Promise<T>;

/** Calculation can take a few seconds for long routes. */
const ROUTING_TIMEOUT_MS = 20_000;

/**
 * The response did not match the contract. Shown as an unexpected error; never contains
 * response data, so nothing personal ends up in messages or logs.
 */
export class InvalidResponseError extends Error {
  constructor(what: string) {
    super(`Invalid response: ${what}`);
    this.name = 'InvalidResponseError';
  }
}

/** Endpoints of the route planner, bound to a send function (`session.authorized` in the app). */
export function routesApi(send: Send) {
  return {
    async calculateRoute(
      discipline: Discipline,
      points: LatLon[],
      signal?: AbortSignal,
    ): Promise<CalculatedRoute> {
      const body = await send<unknown>('/api/routing/route', {
        method: 'POST',
        body: { discipline, points: points.map(toLatLon) },
        timeoutMs: ROUTING_TIMEOUT_MS,
        signal,
      });
      return parseCalculatedRoute(body);
    },

    async searchPlaces(query: string, near?: LatLon, signal?: AbortSignal): Promise<Place[]> {
      const params = new URLSearchParams({ q: query.trim() });
      if (near) {
        params.set('lat', near.lat.toFixed(4));
        params.set('lon', near.lon.toFixed(4));
      }
      const body = await send<unknown>(`/api/places?${params.toString()}`, { signal });
      return parsePlaces(body);
    },

    async listRoutes(): Promise<SavedRouteSummary[]> {
      const body = await send<unknown>('/api/routes');
      return sortNewestFirst(parseList(body, 'routes', parseSummary));
    },

    async getRoute(id: string): Promise<SavedRoute> {
      return parseSavedRoute(await send<unknown>(`/api/routes/${encodeURIComponent(id)}`));
    },

    async createRoute(route: SaveRouteBody): Promise<SavedRoute> {
      const body = await send<unknown>('/api/routes', {
        method: 'POST',
        body: toSaveBody(route),
        timeoutMs: ROUTING_TIMEOUT_MS,
      });
      return parseSavedRoute(body);
    },

    async updateRoute(id: string, route: SaveRouteBody): Promise<SavedRoute> {
      const body = await send<unknown>(`/api/routes/${encodeURIComponent(id)}`, {
        method: 'PUT',
        body: toSaveBody(route),
        timeoutMs: ROUTING_TIMEOUT_MS,
      });
      return parseSavedRoute(body);
    },

    async deleteRoute(id: string): Promise<void> {
      await send<void>(`/api/routes/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
  };
}

export type RoutesApi = ReturnType<typeof routesApi>;

/** Why a route calculation failed, so the planner can explain it in plain words. */
export type RouteFailure = 'notFound' | 'unavailable' | 'other';

export function routeFailure(error: unknown): RouteFailure {
  if (!(error instanceof ApiError) || error.kind !== 'http') return 'other';
  if (error.hasProblemType(PROBLEM_TYPES.routeNotFound) || error.status === 422) return 'notFound';
  if (error.hasProblemType(PROBLEM_TYPES.routingUnavailable) || error.status === 503) {
    return 'unavailable';
  }
  return 'other';
}

/** Trimmed name and note in the length limits of the spec; undefined when valid. */
export function validateRouteDetails(
  name: string,
  note: string,
): { name?: 'required' | 'tooLong'; note?: 'tooLong' } | undefined {
  const nameLength = [...name.trim()].length;
  const noteLength = [...note.trim()].length;
  const errors: { name?: 'required' | 'tooLong'; note?: 'tooLong' } = {};
  if (nameLength === 0) errors.name = 'required';
  else if (nameLength > ROUTE_NAME_MAX_LENGTH) errors.name = 'tooLong';
  if (noteLength > ROUTE_NOTE_MAX_LENGTH) errors.note = 'tooLong';
  return errors.name || errors.note ? errors : undefined;
}

export function sortNewestFirst<T extends { updatedAt: string }>(routes: T[]): T[] {
  return [...routes].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

function toLatLon({ lat, lon }: LatLon): LatLon {
  return { lat, lon };
}

function toSaveBody(route: SaveRouteBody): SaveRouteBody {
  const note = route.note?.trim();
  return {
    name: route.name.trim(),
    ...(note ? { note } : {}),
    discipline: route.discipline,
    points: route.points.map(toLatLon),
  };
}

// --- Parsing: check the shape we rely on, fail with InvalidResponseError otherwise ---

type Json = Record<string, unknown>;

export function isObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function requireObject(value: unknown, what: string): Json {
  if (!isObject(value)) throw new InvalidResponseError(what);
  return value;
}

export function requireNumber(value: unknown, what: string): number {
  if (!isFiniteNumber(value)) throw new InvalidResponseError(what);
  return value;
}

export function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') throw new InvalidResponseError(what);
  return value;
}

export function parseList<T>(value: unknown, what: string, parseItem: (item: unknown) => T): T[] {
  if (!Array.isArray(value)) throw new InvalidResponseError(what);
  return value.map(parseItem);
}

export function parseDiscipline(value: unknown): Discipline {
  if (typeof value === 'string' && (DISCIPLINES as readonly string[]).includes(value)) {
    return value as Discipline;
  }
  throw new InvalidResponseError('discipline');
}

export function parseAscend(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  return requireNumber(value, 'ascendMeters');
}

function parsePosition(value: unknown): Position {
  if (!Array.isArray(value) || value.length < 2 || !value.every(isFiniteNumber)) {
    throw new InvalidResponseError('coordinate');
  }
  const [lon, lat, ele] = value as number[];
  return ele === undefined ? [lon, lat] : [lon, lat, ele];
}

export function parseGeometry(value: unknown): LineString {
  const geometry = requireObject(value, 'geometry');
  if (geometry.type !== 'LineString') throw new InvalidResponseError('geometry type');
  const coordinates = parseList(geometry.coordinates, 'coordinates', parsePosition);
  if (coordinates.length < 2) throw new InvalidResponseError('coordinates');
  return { type: 'LineString', coordinates };
}

export function parseProfile(value: unknown): ProfilePoint[] {
  if (value === null || value === undefined) return [];
  return parseList(value, 'elevationProfile', (item) => {
    if (!Array.isArray(item) || item.length < 2) throw new InvalidResponseError('profile');
    return [requireNumber(item[0], 'profile'), requireNumber(item[1], 'profile')];
  });
}

export function parseSurfaces(value: unknown): SurfaceShare[] {
  if (value === null || value === undefined) return [];
  return parseList(value, 'surfaces', (item) => {
    const surface = requireObject(item, 'surface');
    return {
      surface: requireString(surface.surface, 'surface'),
      meters: requireNumber(surface.meters, 'surface meters'),
    };
  });
}

export function parseCalculatedRoute(value: unknown): CalculatedRoute {
  const route = requireObject(value, 'route');
  return {
    geometry: parseGeometry(route.geometry),
    distanceMeters: requireNumber(route.distanceMeters, 'distanceMeters'),
    ascendMeters: parseAscend(route.ascendMeters),
    elevationProfile: parseProfile(route.elevationProfile),
    surfaces: parseSurfaces(route.surfaces),
  };
}

export function parseLatLon(value: unknown): LatLon {
  const point = requireObject(value, 'point');
  return { lat: requireNumber(point.lat, 'lat'), lon: requireNumber(point.lon, 'lon') };
}

export function parsePlaces(value: unknown): Place[] {
  return parseList(value, 'places', (item) => {
    const place = requireObject(item, 'place');
    const name = typeof place.name === 'string' ? place.name : '';
    const label = typeof place.label === 'string' ? place.label : name;
    return { name: name || label, label, ...parseLatLon(place) };
  });
}

function parseSummary(value: unknown): SavedRouteSummary {
  const route = requireObject(value, 'route');
  return {
    id: String(route.id ?? ''),
    name: requireString(route.name, 'name'),
    discipline: parseDiscipline(route.discipline),
    distanceMeters: requireNumber(route.distanceMeters, 'distanceMeters'),
    ascendMeters: parseAscend(route.ascendMeters),
    updatedAt: requireString(route.updatedAt, 'updatedAt'),
  };
}

export function parseSavedRoute(value: unknown): SavedRoute {
  const route = requireObject(value, 'route');
  const points = parseList(route.points, 'points', parseLatLon);
  if (points.length < MIN_ROUTE_POINTS) throw new InvalidResponseError('points');
  return {
    ...parseCalculatedRoute(route),
    ...parseSummary(route),
    note: typeof route.note === 'string' ? route.note : null,
    points,
    createdAt: requireString(route.createdAt, 'createdAt'),
  };
}
