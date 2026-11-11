import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/ApiError';
import { PROBLEM_TYPES } from '@/api/problem';
import {
  fieldErrorMessage,
  isStaleRideFailure,
  rideErrorMessage,
  rideSaveErrorMessage,
} from '@/rides/rideErrors';
import {
  adminText,
  distanceText,
  placesShortText,
  placesText,
  rideWhenText,
} from '@/rides/rideText';

const problem = (status: number, type?: string) =>
  new ApiError('http', status, { status, ...(type ? { type } : {}), detail: 'backend text' });

describe('rideErrorMessage', () => {
  it('explains each ride problem type in plain words', () => {
    expect(rideErrorMessage(problem(409, PROBLEM_TYPES.limitBelowParticipants))).toMatch(
      /lower than the number of riders/,
    );
    expect(rideErrorMessage(problem(409, PROBLEM_TYPES.ageRatingChangeBlocked))).toMatch(
      /riders under 18 have already joined/,
    );
    expect(rideErrorMessage(problem(403, PROBLEM_TYPES.adultConfirmationRequired))).toMatch(
      /18 or older/,
    );
  });

  it('explains why a ride cannot be changed, published, deleted, cancelled or handed over', () => {
    const cases: [number, string, RegExp][] = [
      [403, 'urn:cycling:problem:not-ride-admin', /Only the ride admin can do this/],
      [409, 'urn:cycling:problem:ride-not-editable', /already started or was cancelled/],
      [409, 'urn:cycling:problem:ride-not-draft', /no longer a draft/],
      [409, 'urn:cycling:problem:ride-not-published', /still a draft, so it can't be cancelled/],
      [409, 'urn:cycling:problem:handover-target-invalid', /confirmed their place/],
    ];
    for (const [status, type, text] of cases) {
      const message = rideErrorMessage(problem(status, type));
      expect(message).toMatch(text);
      expect(message).not.toMatch(/backend text/);
      // Not the generic 409 text
      expect(message).not.toMatch(/changed in the meantime/);
    }
  });

  it('reloads the ride after failures that mean it changed on the server', () => {
    expect(isStaleRideFailure(problem(409, 'urn:cycling:problem:ride-not-editable'))).toBe(true);
    expect(isStaleRideFailure(problem(409, 'urn:cycling:problem:ride-not-draft'))).toBe(true);
    expect(isStaleRideFailure(problem(409, 'urn:cycling:problem:ride-not-published'))).toBe(true);
    expect(isStaleRideFailure(problem(403, 'urn:cycling:problem:not-ride-admin'))).toBe(true);
    expect(isStaleRideFailure(problem(400))).toBe(false);
    expect(isStaleRideFailure(problem(409, PROBLEM_TYPES.limitBelowParticipants))).toBe(false);
  });

  it('mentions the route when saving with an attached route answers 404', () => {
    expect(rideSaveErrorMessage(problem(404), true)).toMatch(/attached route or the ride/);
    expect(rideSaveErrorMessage(problem(404), false)).toMatch(/does not exist/);
    expect(rideSaveErrorMessage(problem(409, PROBLEM_TYPES.limitBelowParticipants), true)).toMatch(
      /including you/,
    );
  });

  it('falls back by status and never shows backend text', () => {
    expect(rideErrorMessage(problem(404))).toMatch(/does not exist/);
    expect(rideErrorMessage(problem(403))).toMatch(/not allowed/);
    expect(rideErrorMessage(problem(409))).toMatch(/changed in the meantime/);
    expect(rideErrorMessage(problem(500))).toBe(
      'Something went wrong on our side. Try again later.',
    );
    expect(rideErrorMessage(problem(500))).not.toMatch(/backend text/);
  });
});

describe('fieldErrorMessage', () => {
  it('gives each field its own text', () => {
    expect(fieldErrorMessage('name', 'required')).toBe('Enter a name for the ride.');
    expect(fieldErrorMessage('meetingPoint', 'required')).toBe('Set a meeting point to publish.');
    expect(fieldErrorMessage('pace', 'required')).toBe('Required to publish.');
    expect(fieldErrorMessage('participantLimit', 'outOfRange')).toBe(
      'Enter a whole number from 2 to 50.',
    );
    expect(fieldErrorMessage('targetDistanceKm', 'invalid')).toBe(
      'Enter a distance from 1 to 500 km.',
    );
    expect(fieldErrorMessage('startTime', 'tooSoon')).toBe(
      'The start must be at least 30 minutes from now.',
    );
    expect(fieldErrorMessage('name', undefined)).toBeUndefined();
  });
});

describe('ride text', () => {
  it('words a planned distance as about … (planned)', () => {
    expect(distanceText({ kind: 'planned', km: 60 })).toBe('about 60 km (planned)');
    expect(distanceText({ kind: 'calculated', meters: 42_315 })).toBe('42.3 km');
  });

  it('shows the start in the meeting point zone with its label', () => {
    const text = rideWhenText({
      startDate: '2026-11-15',
      startTime: '09:30',
      timeZone: 'Europe/Luxembourg',
      startsAt: '2026-11-15T08:30:00Z',
    });
    expect(text).toContain('09:30');
    expect(text).toContain('Europe/Luxembourg');
    expect(rideWhenText({ startDate: null, startTime: null, timeZone: null, startsAt: null })).toBe(
      'No date yet',
    );
  });

  it('shows an incomplete draft without startsAt by what it has', () => {
    const dateOnly = rideWhenText({
      startDate: '2026-11-15',
      startTime: null,
      timeZone: 'Europe/Luxembourg',
      startsAt: null,
    });
    expect(dateOnly).toMatch(/2026/);
    expect(dateOnly).not.toMatch(/Europe/);
    // Date and time but no zone yet: no startsAt from the backend, shown without a zone
    const noZone = rideWhenText({
      startDate: '2026-11-15',
      startTime: '09:30',
      timeZone: null,
      startsAt: null,
    });
    expect(noZone).toContain('09:30');
  });

  it('words places with the admin and riders who must reconfirm counted', () => {
    expect(placesShortText({ kind: 'left', left: 7, taken: 3, limit: 10 })).toBe(
      '3 of 10 places taken',
    );
    expect(placesText({ kind: 'left', left: 7, taken: 3, limit: 10 })).toBe(
      '3 of 10 places taken, 7 left. The admin and riders asked to confirm again hold a place too.',
    );
    expect(placesText({ kind: 'full', limit: 10 })).toBe('Full: all 10 places taken');
    expect(placesShortText({ kind: 'noLimit', taken: 1 })).toBe('1 place taken, no limit set yet');
    expect(placesText({ kind: 'noLimit', taken: 2 })).toBe('2 places taken, no limit set yet');
  });

  it('names a deleted admin plainly', () => {
    expect(adminText({ kind: 'deleted' })).toBe('Deleted rider');
    expect(adminText({ kind: 'name', name: 'Test Rider' })).toBe('Test Rider');
    expect(adminText({ kind: 'unnamed' })).toBe('A rider without a display name');
  });
});
