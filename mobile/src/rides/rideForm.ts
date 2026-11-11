/**
 * The ride form: its state, validation (mirrors the spec; the backend is authoritative) and
 * the mapping to and from the API body.
 */
import type { Discipline, LatLon, SavedRoute } from '@/api/routes';
import {
  PARTICIPANT_LIMIT_MAX,
  PARTICIPANT_LIMIT_MIN,
  PUBLISH_LEAD_MINUTES,
  RIDE_DESCRIPTION_MAX_LENGTH,
  RIDE_NAME_MAX_LENGTH,
  RIDE_NAME_MIN_LENGTH,
  TARGET_DISTANCE_MAX_KM,
  TARGET_DISTANCE_MIN_KM,
  type AccessMode,
  type Pace,
  type Ride,
  type RideBody,
} from '@/api/rides';
import { minutesUntilStart, parseDate, parseTime } from '@/rides/dateTime';

/** The route of the ride: a saved route attached in this form, or the ride's own copy. */
export type FormRoute = {
  /** Saved route id when attached in this form; null for the copy the ride already has */
  routeId: string | null;
  /** Saved route name, when known */
  name: string | null;
  distanceMeters: number | null;
};

export type RideForm = {
  name: string;
  description: string;
  /** YYYY-MM-DD or null */
  startDate: string | null;
  /** HH:mm or null */
  startTime: string | null;
  timeZone: string;
  meetingPoint: LatLon | null;
  discipline: Discipline | null;
  pace: Pace | null;
  /** As typed, so half-typed values can be shown and explained */
  participantLimit: string;
  accessMode: AccessMode | null;
  route: FormRoute | null;
  /** As typed; used only while the ride has no route */
  targetDistanceKm: string;
};

export type RideField =
  | 'name'
  | 'description'
  | 'startDate'
  | 'startTime'
  | 'meetingPoint'
  | 'discipline'
  | 'pace'
  | 'participantLimit'
  | 'accessMode'
  | 'route'
  | 'targetDistanceKm';

export const RIDE_FIELDS: readonly RideField[] = [
  'name',
  'description',
  'startDate',
  'startTime',
  'meetingPoint',
  'discipline',
  'pace',
  'participantLimit',
  'accessMode',
  'route',
  'targetDistanceKm',
];

export type FieldError =
  | 'required'
  | 'tooShort'
  | 'tooLong'
  | 'invalid'
  | 'outOfRange'
  | 'tooSoon'
  | 'inPast'
  | 'belowParticipants'
  /** The server rejected the value; the app has no more specific text */
  | 'server';

export type FieldErrors = Partial<Record<RideField, FieldError>>;

/**
 * - `draft`: saving a draft; only the name is required, filled-in values must be valid.
 * - `publish`: publishing; every required field, start at least 30 minutes ahead.
 * - `published`: saving a published ride; every required field, a changed start in the future.
 */
export type ValidationMode = 'draft' | 'publish' | 'published';

export type ValidationContext = {
  now: number;
  /** Confirmed riders, including the admin; the limit cannot go below it */
  confirmedCount?: number;
  /** For `published`: date or time differ from the saved ride */
  startChanged?: boolean;
};

export function emptyRideForm(timeZone: string): RideForm {
  return {
    name: '',
    description: '',
    startDate: null,
    startTime: null,
    timeZone,
    meetingPoint: null,
    discipline: null,
    pace: null,
    participantLimit: '',
    accessMode: null,
    route: null,
    targetDistanceKm: '',
  };
}

/** A new ride from a saved route: meeting point at the route start, the route's discipline. */
export function rideFormFromRoute(route: SavedRoute, timeZone: string): RideForm {
  return {
    ...emptyRideForm(timeZone),
    name: route.name.slice(0, RIDE_NAME_MAX_LENGTH),
    meetingPoint: route.points[0] ? { lat: route.points[0].lat, lon: route.points[0].lon } : null,
    discipline: route.discipline,
    route: { routeId: route.id, name: route.name, distanceMeters: route.distanceMeters },
  };
}

/** The form for editing an existing ride. */
export function rideFormFromRide(ride: Ride, fallbackTimeZone: string): RideForm {
  const hasRoute = !ride.distanceIsPlanned && ride.distanceMeters !== null;
  return {
    name: ride.name,
    description: ride.description ?? '',
    startDate: ride.startDate,
    startTime: ride.startTime,
    timeZone: ride.timeZone ?? fallbackTimeZone,
    meetingPoint: ride.meetingPoint,
    discipline: ride.discipline,
    pace: ride.pace,
    participantLimit: ride.participantLimit === null ? '' : String(ride.participantLimit),
    accessMode: ride.accessMode,
    route: hasRoute ? { routeId: null, name: null, distanceMeters: ride.distanceMeters } : null,
    targetDistanceKm:
      !hasRoute && ride.targetDistanceKm !== null ? String(ride.targetDistanceKm) : '',
  };
}

/** Attaching a saved route replaces the target distance and suggests its start and discipline. */
export function attachRoute(form: RideForm, route: SavedRoute): RideForm {
  return {
    ...form,
    route: { routeId: route.id, name: route.name, distanceMeters: route.distanceMeters },
    targetDistanceKm: '',
    meetingPoint:
      form.meetingPoint ??
      (route.points[0] ? { lat: route.points[0].lat, lon: route.points[0].lon } : null),
    discipline: form.discipline ?? route.discipline,
  };
}

const length = (text: string) => [...text.trim()].length;

/** "42" → 42; "" → null; anything else NaN. Whole numbers only. */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

/** "60", "60.5" or "60,5" → number; "" → null; anything else NaN. */
export function parseDecimal(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return null;
  return /^\d+([.,]\d+)?$/.test(trimmed) ? Number(trimmed.replace(',', '.')) : Number.NaN;
}

/** Field errors for the given mode; an empty object when the form is valid. */
export function validateRideForm(
  form: RideForm,
  mode: ValidationMode,
  context: ValidationContext,
): FieldErrors {
  const errors: FieldErrors = {};
  const complete = mode !== 'draft';

  const nameLength = length(form.name);
  if (nameLength === 0) errors.name = 'required';
  else if (nameLength < RIDE_NAME_MIN_LENGTH) errors.name = 'tooShort';
  else if (nameLength > RIDE_NAME_MAX_LENGTH) errors.name = 'tooLong';

  if (length(form.description) > RIDE_DESCRIPTION_MAX_LENGTH) errors.description = 'tooLong';

  if (form.startDate !== null && !parseDate(form.startDate)) errors.startDate = 'invalid';
  else if (complete && form.startDate === null) errors.startDate = 'required';
  if (form.startTime !== null && !parseTime(form.startTime)) errors.startTime = 'invalid';
  else if (complete && form.startTime === null) errors.startTime = 'required';

  if (!errors.startDate && !errors.startTime && complete) {
    const minutes = minutesUntilStart(form.startDate, form.startTime, form.timeZone, context.now);
    if (minutes !== null) {
      if (mode === 'publish' && minutes < PUBLISH_LEAD_MINUTES) errors.startTime = 'tooSoon';
      if (mode === 'published' && context.startChanged && minutes <= 0) errors.startTime = 'inPast';
    }
  }

  if (complete && !form.meetingPoint) errors.meetingPoint = 'required';
  if (complete && !form.discipline) errors.discipline = 'required';
  if (complete && !form.pace) errors.pace = 'required';
  if (complete && !form.accessMode) errors.accessMode = 'required';

  const limit = parseWholeNumber(form.participantLimit);
  if (limit === null) {
    if (complete) errors.participantLimit = 'required';
  } else if (Number.isNaN(limit)) {
    errors.participantLimit = 'invalid';
  } else if (limit < PARTICIPANT_LIMIT_MIN || limit > PARTICIPANT_LIMIT_MAX) {
    errors.participantLimit = 'outOfRange';
  } else if (limit < (context.confirmedCount ?? 0)) {
    errors.participantLimit = 'belowParticipants';
  }

  if (!form.route) {
    const target = parseDecimal(form.targetDistanceKm);
    if (target === null) {
      if (complete) errors.targetDistanceKm = 'required';
    } else if (Number.isNaN(target)) {
      errors.targetDistanceKm = 'invalid';
    } else if (target < TARGET_DISTANCE_MIN_KM || target > TARGET_DISTANCE_MAX_KM) {
      errors.targetDistanceKm = 'outOfRange';
    }
  }

  return errors;
}

export function hasErrors(errors: FieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/** The body for create and update. Call only with a form that passed validation. */
export function toRideBody(form: RideForm): RideBody {
  const description = form.description.trim();
  const limit = parseWholeNumber(form.participantLimit);
  const target = form.route ? null : parseDecimal(form.targetDistanceKm);
  return {
    name: form.name.trim(),
    description: description === '' ? null : description,
    startDate: form.startDate,
    startTime: form.startTime,
    timeZone: form.timeZone,
    meetingPoint: form.meetingPoint
      ? { lat: form.meetingPoint.lat, lon: form.meetingPoint.lon }
      : null,
    discipline: form.discipline,
    pace: form.pace,
    participantLimit: limit === null || Number.isNaN(limit) ? null : limit,
    accessMode: form.accessMode,
    // Sent only when a saved route was attached here; otherwise the ride keeps its copy
    ...(form.route?.routeId ? { routeId: form.route.routeId } : {}),
    targetDistanceKm: target === null || Number.isNaN(target) ? null : target,
  };
}

/**
 * Maps the field names of a backend validation problem to form fields. Nested names
 * ("meetingPoint.lat") count for their field; the start instant counts for the start time.
 * Unknown names are returned separately, to show one message for the whole form.
 */
export function mapServerFields(fields: string[]): { errors: FieldErrors; unknown: string[] } {
  const errors: FieldErrors = {};
  const unknown: string[] = [];
  for (const raw of fields) {
    const base = raw.split(/[.[]/)[0];
    const field: RideField | undefined =
      base === 'startsAt'
        ? 'startTime'
        : base === 'routeId'
          ? 'route'
          : base === 'timeZone'
            ? 'startTime'
            : (RIDE_FIELDS as readonly string[]).includes(base)
              ? (base as RideField)
              : undefined;
    if (field) errors[field] = 'server';
    else unknown.push(raw);
  }
  return { errors, unknown };
}

/**
 * Server field errors with the app's own reason where it has one (e.g. "at least 30 minutes
 * ahead"), so the rider gets a helpful text and never the backend's.
 */
export function explainServerErrors(server: FieldErrors, local: FieldErrors): FieldErrors {
  const explained: FieldErrors = {};
  for (const field of Object.keys(server) as RideField[]) {
    explained[field] = local[field] ?? 'server';
  }
  return explained;
}

/** The start date or time differs from the saved ride (for edit validation). */
export function startChanged(
  form: RideForm,
  ride: Pick<Ride, 'startDate' | 'startTime' | 'timeZone'>,
): boolean {
  return (
    form.startDate !== ride.startDate ||
    form.startTime !== ride.startTime ||
    (ride.timeZone !== null && form.timeZone !== ride.timeZone)
  );
}
