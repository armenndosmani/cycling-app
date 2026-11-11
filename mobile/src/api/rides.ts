/**
 * Ride events API contract (backend issue #40): create, edit, publish, cancel and delete rides,
 * the rider's own rides and a ride's details. All types and response parsing live here, so a
 * change on the backend side only needs changes in this file.
 */
import { ApiError } from '@/api/ApiError';
import type { RequestOptions } from '@/api/client';
import { PROBLEM_TYPES } from '@/api/problem';
import {
  DISCIPLINES,
  InvalidResponseError,
  isFiniteNumber,
  isObject,
  parseAscend,
  parseGeometry,
  parseLatLon,
  parseList,
  parseProfile,
  parseSurfaces,
  requireNumber,
  requireObject,
  requireString,
  type Discipline,
  type LatLon,
  type LineString,
  type ProfilePoint,
  type SurfaceShare,
} from '@/api/routes';

export const PACES = ['RELAXED', 'STEADY', 'FAST', 'MIXED'] as const;
export type Pace = (typeof PACES)[number];

export const ACCESS_MODES = ['OPEN', 'APPROVAL', 'INVITE_ONLY'] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

export type RideStatus = 'DRAFT' | 'PUBLISHED' | 'CANCELLED';
export type ViewerRole = 'ADMIN' | 'PARTICIPANT' | 'NONE';
/** Set by the backend from the route; the admin cannot choose it. */
export type AgeRating = '16+' | '18+';

// Limits from the ride event spec (docs/specs/ride-event-creation.md)
export const RIDE_NAME_MIN_LENGTH = 3;
export const RIDE_NAME_MAX_LENGTH = 80;
export const RIDE_DESCRIPTION_MAX_LENGTH = 2000;
export const PARTICIPANT_LIMIT_MIN = 2;
export const PARTICIPANT_LIMIT_MAX = 50;
export const TARGET_DISTANCE_MIN_KM = 1;
export const TARGET_DISTANCE_MAX_KM = 500;
export const RIDE_CANCEL_MESSAGE_MAX_LENGTH = 500;
/** A ride can be published only when it starts at least this far in the future. */
export const PUBLISH_LEAD_MINUTES = 30;

/**
 * Body of `POST /api/rides` and `PUT /api/rides/{id}`. Only the name is required while the ride
 * is a draft. `routeId` is sent only when a saved route is attached (the server copies it);
 * leaving it out keeps the ride's current route copy.
 */
export type RideBody = {
  name: string;
  description: string | null;
  /** YYYY-MM-DD, local to `timeZone` */
  startDate: string | null;
  /** HH:mm, local to `timeZone` */
  startTime: string | null;
  /** IANA zone of the meeting point, e.g. Europe/Luxembourg */
  timeZone: string | null;
  meetingPoint: LatLon | null;
  discipline: Discipline | null;
  pace: Pace | null;
  participantLimit: number | null;
  accessMode: AccessMode | null;
  routeId?: string | null;
  targetDistanceKm: number | null;
};

/** The meeting point generalised for riders who have not joined: a circle, never exact. */
export type MeetingArea = { lat: number; lon: number; radiusMeters: number };

/** One ride in `GET /api/rides/mine`. */
export type RideSummary = {
  id: string;
  status: RideStatus;
  past: boolean;
  name: string;
  /** ISO instant of the start, null while a draft has no date or time */
  startsAt: string | null;
  startDate: string | null;
  startTime: string | null;
  timeZone: string | null;
  discipline: Discipline | null;
  ageRating: AgeRating | null;
  distanceMeters: number | null;
  /** True when the distance is the admin's target distance, not a calculated route */
  distanceIsPlanned: boolean;
  targetDistanceKm: number | null;
  confirmedCount: number;
  participantLimit: number | null;
  viewerRole: ViewerRole;
};

/** A ride, as returned by `GET /api/rides/{id}` and the write endpoints. */
export type Ride = RideSummary & {
  description: string | null;
  pace: Pace | null;
  placesLeft: number | null;
  accessMode: AccessMode | null;
  admin: { id: string; displayName: string } | null;
  ascendMeters: number | null;
  elevationProfile: ProfilePoint[];
  surfaces: SurfaceShare[];
  /** Only for the admin and confirmed participants */
  meetingPoint: LatLon | null;
  /** For everyone else instead of the exact point */
  meetingArea: MeetingArea | null;
  /** Only for the admin and confirmed participants */
  routeGeometry: LineString | null;
  cancelMessage: string | null;
  needsReconfirmation: boolean;
};

type Send = <T>(path: string, options?: RequestOptions) => Promise<T>;

/** Copying and rating a long route can take a moment. */
const WRITE_TIMEOUT_MS = 20_000;

const ridePath = (id: string) => `/api/rides/${encodeURIComponent(id)}`;

/** Endpoints of ride events, bound to a send function (`session.authorized` in the app). */
export function ridesApi(send: Send) {
  return {
    async listMine(): Promise<RideSummary[]> {
      return parseList(await send<unknown>('/api/rides/mine'), 'rides', parseRideSummary);
    },

    async getRide(id: string, signal?: AbortSignal): Promise<Ride> {
      return parseRide(await send<unknown>(ridePath(id), { signal }));
    },

    async createRide(body: RideBody): Promise<Ride> {
      return parseRide(
        await send<unknown>('/api/rides', { method: 'POST', body, timeoutMs: WRITE_TIMEOUT_MS }),
      );
    },

    async updateRide(id: string, body: RideBody): Promise<Ride> {
      return parseRide(
        await send<unknown>(ridePath(id), { method: 'PUT', body, timeoutMs: WRITE_TIMEOUT_MS }),
      );
    },

    async publishRide(id: string): Promise<Ride> {
      return parseRide(await send<unknown>(`${ridePath(id)}/publish`, { method: 'POST' }));
    },

    async cancelRide(id: string, message?: string): Promise<Ride> {
      const trimmed = message?.trim();
      return parseRide(
        await send<unknown>(`${ridePath(id)}/cancel`, {
          method: 'POST',
          body: trimmed ? { message: trimmed } : {},
        }),
      );
    },

    // TODO(#41 follow-up): hand-over UI once the participant list exists (joining spec)
    async handOverRide(id: string, userId: string): Promise<Ride> {
      return parseRide(
        await send<unknown>(`${ridePath(id)}/handover`, { method: 'POST', body: { userId } }),
      );
    },

    /** Drafts only; published rides are cancelled instead. */
    async deleteRide(id: string): Promise<void> {
      await send<void>(ridePath(id), { method: 'DELETE' });
    },
  };
}

export type RidesApi = ReturnType<typeof ridesApi>;

// --- Errors ---

/** Why a ride request failed, so screens can explain it in plain words. */
export type RideFailure =
  | 'limitBelowParticipants'
  | 'ageRatingChangeBlocked'
  | 'adultConfirmationRequired'
  | 'validation'
  | 'notFound'
  | 'forbidden'
  | 'conflict'
  | 'other';

export function rideFailure(error: unknown): RideFailure {
  if (!(error instanceof ApiError) || error.kind !== 'http') return 'other';
  if (error.hasProblemType(PROBLEM_TYPES.limitBelowParticipants)) return 'limitBelowParticipants';
  if (error.hasProblemType(PROBLEM_TYPES.ageRatingChangeBlocked)) return 'ageRatingChangeBlocked';
  if (error.hasProblemType(PROBLEM_TYPES.adultConfirmationRequired)) {
    return 'adultConfirmationRequired';
  }
  if (error.status === 400 || error.status === 422) return 'validation';
  if (error.status === 404) return 'notFound';
  if (error.status === 403) return 'forbidden';
  if (error.status === 409) return 'conflict';
  return 'other';
}

/**
 * Field names of a 400 validation problem (`errors: [{ field, message }]`). The backend's
 * messages are never shown; the app shows its own text for each field.
 */
export function validationFields(error: unknown): string[] {
  if (!(error instanceof ApiError) || !error.problem) return [];
  const errors = error.problem.errors;
  if (!Array.isArray(errors)) return [];
  const fields = errors
    .map((item) => (isObject(item) && typeof item.field === 'string' ? item.field : null))
    .filter((field): field is string => field !== null && field.length > 0);
  return [...new Set(fields)];
}

// --- Parsing: check the shape we rely on, fail with InvalidResponseError otherwise ---

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function optionalNumber(value: unknown, what: string): number | null {
  if (value === null || value === undefined) return null;
  return requireNumber(value, what);
}

function optionalEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  what: string,
): T | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  throw new InvalidResponseError(what);
}

function parseStatus(value: unknown): RideStatus {
  if (value === 'DRAFT' || value === 'PUBLISHED') return value;
  if (value === 'CANCELLED' || value === 'CANCELED') return 'CANCELLED';
  throw new InvalidResponseError('status');
}

function parseViewerRole(value: unknown): ViewerRole {
  if (value === 'ADMIN' || value === 'PARTICIPANT') return value;
  // Missing or unknown: treat as an outsider, so nothing exact is shown by mistake
  return 'NONE';
}

/** Accepts "16+", "SIXTEEN_PLUS", "AGE_16" and the like; unknown values show no badge. */
export function parseAgeRating(value: unknown): AgeRating | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  if (upper.includes('16') || upper.includes('SIXTEEN')) return '16+';
  if (upper.includes('18') || upper.includes('EIGHTEEN')) return '18+';
  return null;
}

function parseMeetingArea(value: unknown): MeetingArea | null {
  if (value === null || value === undefined) return null;
  const area = requireObject(value, 'meetingArea');
  return { ...parseLatLon(area), radiusMeters: requireNumber(area.radiusMeters, 'radius') };
}

function parseAdmin(value: unknown): Ride['admin'] {
  if (!isObject(value)) return null;
  return {
    id: String(value.id ?? ''),
    displayName: typeof value.displayName === 'string' ? value.displayName : '',
  };
}

export function parseRideSummary(value: unknown): RideSummary {
  const ride = requireObject(value, 'ride');
  return {
    id: String(ride.id ?? ''),
    status: parseStatus(ride.status),
    past: ride.past === true,
    name: requireString(ride.name, 'name'),
    startsAt: optionalString(ride.startsAt),
    startDate: optionalString(ride.startDate),
    startTime: optionalString(ride.startTime),
    timeZone: optionalString(ride.timeZone),
    discipline: optionalEnum(ride.discipline, DISCIPLINES, 'discipline'),
    ageRating: parseAgeRating(ride.ageRating),
    distanceMeters: optionalNumber(ride.distanceMeters, 'distanceMeters'),
    distanceIsPlanned: ride.distanceIsPlanned === true,
    targetDistanceKm: optionalNumber(ride.targetDistanceKm, 'targetDistanceKm'),
    confirmedCount: isFiniteNumber(ride.confirmedCount) ? ride.confirmedCount : 0,
    participantLimit: optionalNumber(ride.participantLimit, 'participantLimit'),
    viewerRole: parseViewerRole(ride.viewerRole),
  };
}

export function parseRide(value: unknown): Ride {
  const ride = requireObject(value, 'ride');
  return {
    ...parseRideSummary(ride),
    description: optionalString(ride.description),
    pace: optionalEnum(ride.pace, PACES, 'pace'),
    placesLeft: optionalNumber(ride.placesLeft, 'placesLeft'),
    accessMode: optionalEnum(ride.accessMode, ACCESS_MODES, 'accessMode'),
    admin: parseAdmin(ride.admin),
    ascendMeters: parseAscend(ride.ascendMeters),
    elevationProfile: parseProfile(ride.elevationProfile),
    surfaces: parseSurfaces(ride.surfaces),
    meetingPoint:
      ride.meetingPoint === null || ride.meetingPoint === undefined
        ? null
        : parseLatLon(ride.meetingPoint),
    meetingArea: parseMeetingArea(ride.meetingArea),
    routeGeometry:
      ride.routeGeometry === null || ride.routeGeometry === undefined
        ? null
        : parseGeometry(ride.routeGeometry),
    cancelMessage: optionalString(ride.cancelMessage),
    needsReconfirmation: ride.needsReconfirmation === true,
  };
}
