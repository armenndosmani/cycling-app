import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/ApiError';
import type { RequestOptions } from '@/api/client';
import { PROBLEM_TYPES } from '@/api/problem';
import {
  parseAgeRating,
  parseRide,
  parseRideSummary,
  rideFailure,
  ridesApi,
  validationFields,
  type RideBody,
} from '@/api/rides';
import { InvalidResponseError } from '@/api/routes';

// Fake data only
const summary = {
  id: 'ride-1',
  status: 'PUBLISHED',
  past: false,
  name: 'Sunday coffee ride',
  startsAt: '2026-11-15T08:30:00Z',
  startDate: '2026-11-15',
  startTime: '09:30',
  timeZone: 'Europe/Luxembourg',
  discipline: 'ROAD',
  ageRating: '16+',
  distanceMeters: 42_300,
  distanceIsPlanned: false,
  targetDistanceKm: null,
  confirmedCount: 3,
  participantLimit: 10,
  viewerRole: 'ADMIN',
};

const detail = {
  ...summary,
  description: 'Easy loop with a coffee stop.',
  pace: 'STEADY',
  placesLeft: 7,
  accessMode: 'APPROVAL',
  admin: { id: 'u1', displayName: 'Test Rider' },
  ascendMeters: 410,
  elevationProfile: [
    [0, 300],
    [42_300, 320],
  ],
  surfaces: [{ surface: 'asphalt', meters: 42_300 }],
  meetingPoint: { lat: 49.6, lon: 6.1 },
  meetingArea: null,
  routeGeometry: {
    type: 'LineString',
    coordinates: [
      [6.1, 49.6],
      [6.2, 49.7],
    ],
  },
  cancelMessage: null,
  needsReconfirmation: false,
};

const body: RideBody = {
  name: 'Sunday coffee ride',
  description: null,
  startDate: '2026-11-15',
  startTime: '09:30',
  timeZone: 'Europe/Luxembourg',
  meetingPoint: { lat: 49.6, lon: 6.1 },
  discipline: 'ROAD',
  pace: 'STEADY',
  participantLimit: 10,
  accessMode: 'OPEN',
  targetDistanceKm: 60,
};

function apiWith(response: unknown) {
  const send = vi.fn(async (_path: string, _options?: RequestOptions) => response);
  return { api: ridesApi(send as never), send };
}

describe('parsing', () => {
  it('parses a ride with every field', () => {
    const ride = parseRide(detail);
    expect(ride.name).toBe('Sunday coffee ride');
    expect(ride.ageRating).toBe('16+');
    expect(ride.pace).toBe('STEADY');
    expect(ride.meetingPoint).toEqual({ lat: 49.6, lon: 6.1 });
    expect(ride.routeGeometry?.coordinates).toHaveLength(2);
    expect(ride.elevationProfile).toHaveLength(2);
    expect(ride.admin).toEqual({ id: 'u1', displayName: 'Test Rider' });
  });

  it('parses a ride whose admin deleted their account and that has no limit yet', () => {
    const ride = parseRide({
      ...detail,
      status: 'DRAFT',
      admin: null,
      participantLimit: null,
      placesLeft: null,
      startsAt: null,
      startTime: null,
    });
    expect(ride.admin).toBeNull();
    expect(ride.participantLimit).toBeNull();
    expect(ride.placesLeft).toBeNull();
    expect(ride.startsAt).toBeNull();
    expect(ride.startDate).toBe('2026-11-15');
  });

  it('infers a planned distance only when distanceIsPlanned is missing and there is no route', () => {
    const missing = { ...summary, distanceIsPlanned: undefined };
    expect(parseRideSummary(missing).distanceIsPlanned).toBe(false);
    expect(parseRideSummary({ ...missing, distanceMeters: null }).distanceIsPlanned).toBe(true);
  });

  it('parses a draft with almost nothing set', () => {
    const ride = parseRide({ id: 'd1', status: 'DRAFT', name: 'Idea', viewerRole: 'ADMIN' });
    expect(ride).toMatchObject({
      status: 'DRAFT',
      startDate: null,
      startTime: null,
      discipline: null,
      pace: null,
      participantLimit: null,
      accessMode: null,
      meetingPoint: null,
      routeGeometry: null,
      elevationProfile: [],
      surfaces: [],
      past: false,
      confirmedCount: 0,
    });
  });

  it('parses the generalised meeting area of an outsider', () => {
    const ride = parseRide({
      ...detail,
      viewerRole: 'NONE',
      meetingPoint: null,
      routeGeometry: null,
      meetingArea: { lat: 49.61, lon: 6.12, radiusMeters: 500 },
    });
    expect(ride.meetingArea).toEqual({ lat: 49.61, lon: 6.12, radiusMeters: 500 });
    expect(ride.viewerRole).toBe('NONE');
  });

  it('treats a missing or unknown viewer role as an outsider', () => {
    expect(parseRideSummary({ ...summary, viewerRole: undefined }).viewerRole).toBe('NONE');
    expect(parseRideSummary({ ...summary, viewerRole: 'OWNER' }).viewerRole).toBe('NONE');
  });

  it('accepts both spellings of cancelled', () => {
    expect(parseRideSummary({ ...summary, status: 'CANCELED' }).status).toBe('CANCELLED');
    expect(parseRideSummary({ ...summary, status: 'CANCELLED' }).status).toBe('CANCELLED');
  });

  it('reads age ratings in several spellings', () => {
    expect(parseAgeRating('16+')).toBe('16+');
    expect(parseAgeRating('SIXTEEN_PLUS')).toBe('16+');
    expect(parseAgeRating('AGE_18')).toBe('18+');
    expect(parseAgeRating('18+')).toBe('18+');
    expect(parseAgeRating(null)).toBeNull();
    expect(parseAgeRating('PG')).toBeNull();
  });

  it('rejects responses that break the contract', () => {
    expect(() => parseRide(null)).toThrow(InvalidResponseError);
    expect(() => parseRide({ ...detail, status: 'UNKNOWN' })).toThrow(InvalidResponseError);
    expect(() => parseRide({ ...detail, pace: 'WARP' })).toThrow(InvalidResponseError);
    expect(() => parseRide({ ...detail, name: 42 })).toThrow(InvalidResponseError);
    expect(() => parseRide({ ...detail, meetingArea: { lat: 1, lon: 2 } })).toThrow(
      InvalidResponseError,
    );
  });
});

describe('ridesApi', () => {
  it('creates a ride with POST /api/rides', async () => {
    const { api, send } = apiWith(detail);
    const ride = await api.createRide(body);
    expect(ride.id).toBe('ride-1');
    expect(send).toHaveBeenCalledWith(
      '/api/rides',
      expect.objectContaining({ method: 'POST', body }),
    );
  });

  it('updates, publishes, cancels and hands over at the contract paths', async () => {
    const { api, send } = apiWith(detail);
    await api.updateRide('ride 1', body);
    expect(send).toHaveBeenLastCalledWith(
      '/api/rides/ride%201',
      expect.objectContaining({ method: 'PUT', body }),
    );
    await api.publishRide('ride-1');
    expect(send).toHaveBeenLastCalledWith('/api/rides/ride-1/publish', { method: 'POST' });
    await api.cancelRide('ride-1', '  Rain all day  ');
    expect(send).toHaveBeenLastCalledWith('/api/rides/ride-1/cancel', {
      method: 'POST',
      body: { message: 'Rain all day' },
    });
    await api.cancelRide('ride-1', '   ');
    expect(send).toHaveBeenLastCalledWith('/api/rides/ride-1/cancel', {
      method: 'POST',
      body: {},
    });
    await api.handOverRide('ride-1', 'u2');
    expect(send).toHaveBeenLastCalledWith('/api/rides/ride-1/handover', {
      method: 'POST',
      body: { userId: 'u2' },
    });
  });

  it('deletes a draft', async () => {
    const { api, send } = apiWith(undefined);
    await api.deleteRide('d1');
    expect(send).toHaveBeenCalledWith('/api/rides/d1', { method: 'DELETE' });
  });

  it('lists my rides and loads one ride', async () => {
    const list = apiWith([summary, { ...summary, id: 'ride-2', status: 'DRAFT' }]);
    const rides = await list.api.listMine();
    expect(rides.map((ride) => ride.id)).toEqual(['ride-1', 'ride-2']);
    expect(list.send).toHaveBeenCalledWith('/api/rides/mine');

    const one = apiWith(detail);
    await one.api.getRide('ride-1');
    expect(one.send).toHaveBeenCalledWith('/api/rides/ride-1', { signal: undefined });
  });
});

describe('errors', () => {
  const problem = (status: number, type?: string, extra: object = {}) =>
    new ApiError('http', status, { status, ...(type ? { type } : {}), ...extra });

  it('maps every ride problem type', () => {
    expect(rideFailure(problem(409, PROBLEM_TYPES.limitBelowParticipants))).toBe(
      'limitBelowParticipants',
    );
    expect(rideFailure(problem(409, PROBLEM_TYPES.ageRatingChangeBlocked))).toBe(
      'ageRatingChangeBlocked',
    );
    expect(rideFailure(problem(403, PROBLEM_TYPES.adultConfirmationRequired))).toBe(
      'adultConfirmationRequired',
    );
    expect(rideFailure(problem(403, 'urn:cycling:problem:not-ride-admin'))).toBe('notRideAdmin');
    expect(rideFailure(problem(409, 'urn:cycling:problem:ride-not-editable'))).toBe('notEditable');
    expect(rideFailure(problem(409, 'urn:cycling:problem:ride-not-draft'))).toBe('notDraft');
    expect(rideFailure(problem(409, 'urn:cycling:problem:ride-not-published'))).toBe(
      'notPublished',
    );
    expect(rideFailure(problem(409, 'urn:cycling:problem:handover-target-invalid'))).toBe(
      'handoverTargetInvalid',
    );
  });

  it('falls back to the HTTP status', () => {
    expect(rideFailure(problem(400))).toBe('validation');
    expect(rideFailure(problem(404))).toBe('notFound');
    expect(rideFailure(problem(403))).toBe('forbidden');
    expect(rideFailure(problem(409))).toBe('conflict');
    expect(rideFailure(problem(500))).toBe('other');
    expect(rideFailure(new ApiError('network'))).toBe('other');
    expect(rideFailure(new Error('boom'))).toBe('other');
  });

  it('reads the field names of a validation problem, never the messages', () => {
    const error = problem(400, undefined, {
      errors: [
        { field: 'name', message: 'size must be between 3 and 80' },
        { field: 'meetingPoint.lat', message: 'must not be null' },
        { field: 'name', message: 'duplicate' },
        { message: 'no field' },
        'junk',
      ],
    });
    expect(validationFields(error)).toEqual(['name', 'meetingPoint.lat']);
    expect(validationFields(problem(400))).toEqual([]);
    expect(validationFields(new Error('boom'))).toEqual([]);
  });
});
