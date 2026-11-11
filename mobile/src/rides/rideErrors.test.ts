import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/ApiError';
import { PROBLEM_TYPES } from '@/api/problem';
import { fieldErrorMessage, rideErrorMessage } from '@/rides/rideErrors';
import { distanceText, rideWhenText } from '@/rides/rideText';

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

  it('falls back by status and never shows backend text', () => {
    expect(rideErrorMessage(problem(404))).toMatch(/does not exist/);
    expect(rideErrorMessage(problem(403))).toMatch(/Only the ride admin/);
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
});
