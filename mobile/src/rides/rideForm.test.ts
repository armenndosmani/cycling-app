import { describe, expect, it } from 'vitest';

import { parseRide } from '@/api/rides';
import type { SavedRoute } from '@/api/routes';
import {
  attachRoute,
  emptyRideForm,
  explainServerErrors,
  hasErrors,
  mapServerFields,
  parseDecimal,
  parseWholeNumber,
  rideFormFromRide,
  rideFormFromRoute,
  startChanged,
  toRideBody,
  validateRideForm,
  type RideForm,
} from '@/rides/rideForm';

const ZONE = 'Europe/Luxembourg';
// 2026-11-15 07:00 in Luxembourg
const NOW = Date.parse('2026-11-15T06:00:00Z');

// Fake data only
const route: SavedRoute = {
  id: 'route-1',
  name: 'Test loop',
  note: null,
  discipline: 'GRAVEL',
  points: [
    { lat: 49.6, lon: 6.1 },
    { lat: 49.7, lon: 6.2 },
  ],
  geometry: {
    type: 'LineString',
    coordinates: [
      [6.1, 49.6],
      [6.2, 49.7],
    ],
  },
  distanceMeters: 42_300,
  ascendMeters: 300,
  elevationProfile: [],
  surfaces: [],
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
};

const complete: RideForm = {
  ...emptyRideForm(ZONE),
  name: 'Sunday coffee ride',
  description: '  Easy loop  ',
  startDate: '2026-11-15',
  startTime: '09:00',
  meetingPoint: { lat: 49.6, lon: 6.1 },
  discipline: 'ROAD',
  pace: 'RELAXED',
  participantLimit: '10',
  accessMode: 'OPEN',
  targetDistanceKm: '60',
};

describe('validation', () => {
  it('accepts a complete ride for publishing', () => {
    expect(validateRideForm(complete, 'publish', { now: NOW })).toEqual({});
  });

  it('lets a draft be saved with only a name', () => {
    const draft = { ...emptyRideForm(ZONE), name: 'Idea' };
    expect(validateRideForm(draft, 'draft', { now: NOW })).toEqual({});
  });

  it('requires every field to publish', () => {
    const errors = validateRideForm({ ...emptyRideForm(ZONE), name: 'Idea' }, 'publish', {
      now: NOW,
    });
    expect(errors).toEqual({
      startDate: 'required',
      startTime: 'required',
      meetingPoint: 'required',
      discipline: 'required',
      pace: 'required',
      participantLimit: 'required',
      accessMode: 'required',
      targetDistanceKm: 'required',
    });
  });

  it('checks the name length, also for drafts', () => {
    const check = (name: string) =>
      validateRideForm({ ...complete, name }, 'draft', { now: NOW }).name;
    expect(check('')).toBe('required');
    expect(check('   ')).toBe('required');
    expect(check('ab')).toBe('tooShort');
    expect(check('abc')).toBeUndefined();
    expect(check('x'.repeat(80))).toBeUndefined();
    expect(check('x'.repeat(81))).toBe('tooLong');
  });

  it('limits the description to 2,000 characters', () => {
    const errors = validateRideForm({ ...complete, description: 'x'.repeat(2001) }, 'draft', {
      now: NOW,
    });
    expect(errors.description).toBe('tooLong');
  });

  it('allows 2 to 50 participants, whole numbers only', () => {
    const check = (participantLimit: string) =>
      validateRideForm({ ...complete, participantLimit }, 'draft', { now: NOW }).participantLimit;
    expect(check('2')).toBeUndefined();
    expect(check('50')).toBeUndefined();
    expect(check('1')).toBe('outOfRange');
    expect(check('51')).toBe('outOfRange');
    expect(check('2.5')).toBe('invalid');
    expect(check('-3')).toBe('invalid');
    expect(check('')).toBeUndefined();
  });

  it('keeps the limit at or above the confirmed riders', () => {
    const errors = validateRideForm({ ...complete, participantLimit: '4' }, 'published', {
      now: NOW,
      confirmedCount: 5,
    });
    expect(errors.participantLimit).toBe('belowParticipants');
  });

  it('needs a target distance of 1 to 500 km only without a route', () => {
    const check = (targetDistanceKm: string, form = complete) =>
      validateRideForm({ ...form, targetDistanceKm }, 'publish', { now: NOW }).targetDistanceKm;
    expect(check('1')).toBeUndefined();
    expect(check('500')).toBeUndefined();
    expect(check('60,5')).toBeUndefined();
    expect(check('0.5')).toBe('outOfRange');
    expect(check('501')).toBe('outOfRange');
    expect(check('sixty')).toBe('invalid');
    const withRoute = { ...complete, route: { routeId: 'r1', name: 'Loop', distanceMeters: 1 } };
    expect(check('', withRoute)).toBeUndefined();
  });

  it('publishes only when the start is at least 30 minutes ahead', () => {
    const at = (startTime: string) =>
      validateRideForm({ ...complete, startTime }, 'publish', { now: NOW }).startTime;
    // now is 07:00 local time
    expect(at('07:30')).toBeUndefined();
    expect(at('07:29')).toBe('tooSoon');
    expect(at('06:00')).toBe('tooSoon');
    // Drafts may hold any time
    expect(
      validateRideForm({ ...complete, startTime: '06:00' }, 'draft', { now: NOW }).startTime,
    ).toBeUndefined();
  });

  it('uses the meeting point zone, not the phone zone, for the 30 minutes', () => {
    // 07:45 in Lisbon is 08:45 in Luxembourg: 1 h 45 min ahead of now
    const lisbon = { ...complete, timeZone: 'Europe/Lisbon', startTime: '07:45' };
    expect(validateRideForm(lisbon, 'publish', { now: NOW }).startTime).toBeUndefined();
    // 07:15 in Luxembourg is only 15 minutes ahead
    const lux = { ...complete, startTime: '07:15' };
    expect(validateRideForm(lux, 'publish', { now: NOW }).startTime).toBe('tooSoon');
  });

  it('lets a published ride be edited close to the start; a moved start needs 30 minutes', () => {
    const soon = { ...complete, startTime: '07:10' };
    expect(
      validateRideForm(soon, 'published', { now: NOW, startChanged: false }).startTime,
    ).toBeUndefined();
    // Like the backend: a new start must be at least 30 minutes ahead
    expect(validateRideForm(soon, 'published', { now: NOW, startChanged: true }).startTime).toBe(
      'tooSoon',
    );
    const past = { ...complete, startTime: '06:30' };
    expect(validateRideForm(past, 'published', { now: NOW, startChanged: true }).startTime).toBe(
      'tooSoon',
    );
    const later = { ...complete, startTime: '07:30' };
    expect(
      validateRideForm(later, 'published', { now: NOW, startChanged: true }).startTime,
    ).toBeUndefined();
  });

  it('reports malformed dates and times', () => {
    const errors = validateRideForm(
      { ...complete, startDate: '2026-02-30', startTime: '25:00' },
      'draft',
      { now: NOW },
    );
    expect(errors).toEqual({ startDate: 'invalid', startTime: 'invalid' });
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors({})).toBe(false);
  });
});

describe('numbers', () => {
  it('parses whole numbers and decimals as typed', () => {
    expect(parseWholeNumber(' 12 ')).toBe(12);
    expect(parseWholeNumber('')).toBeNull();
    expect(parseWholeNumber('1e2')).toBeNaN();
    expect(parseDecimal('60,5')).toBe(60.5);
    expect(parseDecimal('60.')).toBeNaN();
    expect(parseDecimal('')).toBeNull();
  });
});

describe('API body', () => {
  it('maps a complete form, trimming text', () => {
    expect(toRideBody(complete)).toEqual({
      name: 'Sunday coffee ride',
      description: 'Easy loop',
      startDate: '2026-11-15',
      startTime: '09:00',
      timeZone: ZONE,
      meetingPoint: { lat: 49.6, lon: 6.1 },
      discipline: 'ROAD',
      pace: 'RELAXED',
      participantLimit: 10,
      accessMode: 'OPEN',
      targetDistanceKm: 60,
    });
  });

  it('sends nulls for a sparse draft and no route id', () => {
    const body = toRideBody({ ...emptyRideForm(ZONE), name: ' Idea ' });
    expect(body).toEqual({
      name: 'Idea',
      description: null,
      startDate: null,
      startTime: null,
      timeZone: ZONE,
      meetingPoint: null,
      discipline: null,
      pace: null,
      participantLimit: null,
      accessMode: null,
      targetDistanceKm: null,
    });
    expect('routeId' in body).toBe(false);
  });

  it('sends the route id of an attached route and drops the target distance', () => {
    const body = toRideBody(attachRoute({ ...complete, targetDistanceKm: '60' }, route));
    expect(body.routeId).toBe('route-1');
    expect(body.targetDistanceKm).toBeNull();
  });

  it('leaves the route id out for the ride’s existing copy', () => {
    const body = toRideBody({
      ...complete,
      route: { routeId: null, name: null, distanceMeters: 42_300 },
    });
    expect('routeId' in body).toBe(false);
    expect(body.targetDistanceKm).toBeNull();
  });
});

describe('forms from routes and rides', () => {
  it('starts a ride from a route at its start with its discipline', () => {
    const form = rideFormFromRoute(route, ZONE);
    expect(form.name).toBe('Test loop');
    expect(form.meetingPoint).toEqual({ lat: 49.6, lon: 6.1 });
    expect(form.discipline).toBe('GRAVEL');
    expect(form.route).toEqual({ routeId: 'route-1', name: 'Test loop', distanceMeters: 42_300 });
    expect(form.timeZone).toBe(ZONE);
  });

  it('attaching a route keeps a meeting point and discipline already chosen', () => {
    const form = attachRoute({ ...complete, discipline: 'ROAD' }, route);
    expect(form.meetingPoint).toEqual(complete.meetingPoint);
    expect(form.discipline).toBe('ROAD');
    expect(form.targetDistanceKm).toBe('');
    const empty = attachRoute(emptyRideForm(ZONE), route);
    expect(empty.meetingPoint).toEqual({ lat: 49.6, lon: 6.1 });
    expect(empty.discipline).toBe('GRAVEL');
  });

  it('fills the form from a ride with a planned distance', () => {
    const ride = parseRide({
      id: 'r1',
      status: 'DRAFT',
      name: 'Idea',
      viewerRole: 'ADMIN',
      distanceIsPlanned: true,
      distanceMeters: 60_000,
      targetDistanceKm: 60,
      participantLimit: 8,
      timeZone: 'Europe/Lisbon',
    });
    const form = rideFormFromRide(ride, ZONE);
    expect(form).toMatchObject({
      name: 'Idea',
      route: null,
      targetDistanceKm: '60',
      participantLimit: '8',
      timeZone: 'Europe/Lisbon',
    });
  });

  it('fills the form from a ride with its own route copy', () => {
    const ride = parseRide({
      id: 'r1',
      status: 'PUBLISHED',
      name: 'Loop',
      viewerRole: 'ADMIN',
      distanceIsPlanned: false,
      distanceMeters: 42_300,
    });
    const form = rideFormFromRide(ride, ZONE);
    expect(form.route).toEqual({ routeId: null, name: null, distanceMeters: 42_300 });
    expect(form.targetDistanceKm).toBe('');
    expect(form.timeZone).toBe(ZONE);
  });

  it('keeps a route copy without a distance, so editing never removes it', () => {
    const ride = parseRide({
      id: 'r1',
      status: 'DRAFT',
      name: 'Loop',
      viewerRole: 'ADMIN',
      distanceIsPlanned: false,
      distanceMeters: null,
    });
    const form = rideFormFromRide(ride, ZONE);
    expect(form.route).toEqual({ routeId: null, name: null, distanceMeters: null });
    // A target distance is never required or sent while the ride has its copy
    expect(validateRideForm(form, 'publish', { now: NOW }).targetDistanceKm).toBeUndefined();
    const body = toRideBody({ ...form, targetDistanceKm: '60' });
    expect(body).not.toHaveProperty('routeId');
    expect(body.targetDistanceKm).toBeNull();
  });

  it('edits a ride with a route copy without touching the route: no routeId, no target', () => {
    const ride = parseRide({
      id: 'r1',
      status: 'PUBLISHED',
      name: 'Loop',
      viewerRole: 'ADMIN',
      distanceIsPlanned: false,
      distanceMeters: 42_300,
      targetDistanceKm: null,
    });
    const body = toRideBody({ ...rideFormFromRide(ride, ZONE), name: 'Renamed loop' });
    // The backend keeps the copy only when neither routeId nor targetDistanceKm is sent
    expect(JSON.parse(JSON.stringify(body))).not.toHaveProperty('routeId');
    expect(body.targetDistanceKm).toBeNull();
  });

  it('notices a moved start', () => {
    const saved = { startDate: '2026-11-15', startTime: '09:00', timeZone: ZONE };
    expect(startChanged(complete, saved)).toBe(false);
    expect(startChanged({ ...complete, startTime: '10:00' }, saved)).toBe(true);
    expect(startChanged({ ...complete, timeZone: 'Europe/Lisbon' }, saved)).toBe(true);
  });
});

describe('server validation errors', () => {
  it('maps backend field names to form fields', () => {
    expect(
      mapServerFields(['name', 'meetingPoint.lat', 'startsAt', 'routeId', 'clubId', 'pace']),
    ).toEqual({
      errors: {
        name: 'server',
        meetingPoint: 'server',
        startTime: 'server',
        route: 'server',
        pace: 'server',
      },
      unknown: ['clubId'],
    });
  });

  it('explains server errors with the app’s own reason where it has one', () => {
    expect(
      explainServerErrors(
        { startTime: 'server', name: 'server' },
        { startTime: 'tooSoon', pace: 'required' },
      ),
    ).toEqual({ startTime: 'tooSoon', name: 'server' });
  });
});
