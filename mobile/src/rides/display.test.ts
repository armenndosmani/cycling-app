import { describe, expect, it } from 'vitest';

import type { RideStatus, ViewerRole } from '@/api/rides';
import { haversineMeters } from '@/planner/geo';
import {
  adminActions,
  adminDisplay,
  circleRing,
  distanceDisplay,
  meetingDisplay,
  placesDisplay,
  rideBadge,
  sortRides,
  visibleRoute,
} from '@/rides/display';

type Row = { id: string; status: RideStatus; past: boolean; startsAt: string | null };

const row = (id: string, status: RideStatus, startsAt: string | null, past = false): Row => ({
  id,
  status,
  past,
  startsAt,
});

describe('list order and labels', () => {
  it('shows upcoming rides first, soonest first, then past and cancelled, latest first', () => {
    const rides = [
      row('past-old', 'PUBLISHED', '2026-10-01T08:00:00Z', true),
      row('later', 'PUBLISHED', '2026-12-01T08:00:00Z'),
      row('cancelled', 'CANCELLED', '2026-11-20T08:00:00Z'),
      row('draft-no-date', 'DRAFT', null),
      row('soon', 'PUBLISHED', '2026-11-12T08:00:00Z'),
      row('draft-dated', 'DRAFT', '2026-11-14T08:00:00Z'),
      row('past-recent', 'PUBLISHED', '2026-11-10T08:00:00Z', true),
    ];
    expect(sortRides(rides).map((ride) => ride.id)).toEqual([
      'soon',
      'draft-dated',
      'later',
      'draft-no-date',
      'cancelled',
      'past-recent',
      'past-old',
    ]);
  });

  it('labels drafts, cancelled and past rides', () => {
    expect(rideBadge({ status: 'DRAFT', past: false })).toBe('draft');
    expect(rideBadge({ status: 'CANCELLED', past: false })).toBe('cancelled');
    expect(rideBadge({ status: 'CANCELLED', past: true })).toBe('cancelled');
    expect(rideBadge({ status: 'PUBLISHED', past: true })).toBe('past');
    // A draft whose date passed never took place: it stays a draft
    expect(rideBadge({ status: 'DRAFT', past: true })).toBe('draft');
    expect(rideBadge({ status: 'PUBLISHED', past: false })).toBeNull();
  });
});

describe('drafts without a start', () => {
  it('keeps drafts without startsAt after dated upcoming rides, in their original order', () => {
    const rides = [
      row('draft-a', 'DRAFT', null),
      row('dated', 'DRAFT', '2026-11-14T08:00:00Z'),
      row('draft-b', 'DRAFT', null),
      row('past', 'PUBLISHED', '2026-11-01T08:00:00Z', true),
    ];
    expect(sortRides(rides).map((ride) => ride.id)).toEqual([
      'dated',
      'draft-a',
      'draft-b',
      'past',
    ]);
  });

  it('treats an unreadable startsAt like a missing one', () => {
    const rides = [
      row('broken', 'DRAFT', 'not a date'),
      row('dated', 'DRAFT', '2026-11-14T08:00:00Z'),
    ];
    expect(sortRides(rides).map((ride) => ride.id)).toEqual(['dated', 'broken']);
  });
});

describe('places', () => {
  it('counts every rider holding a place, the admin included', () => {
    expect(placesDisplay({ confirmedCount: 3, participantLimit: 10, placesLeft: 7 })).toEqual({
      kind: 'left',
      left: 7,
      taken: 3,
      limit: 10,
    });
  });

  it('shows a full ride', () => {
    expect(placesDisplay({ confirmedCount: 10, participantLimit: 10, placesLeft: 0 })).toEqual({
      kind: 'full',
      limit: 10,
    });
  });

  it('shows no limit while placesLeft and the limit are null', () => {
    expect(placesDisplay({ confirmedCount: 1, participantLimit: null, placesLeft: null })).toEqual({
      kind: 'noLimit',
      taken: 1,
    });
  });

  it('works out places left for a summary, never below zero', () => {
    expect(placesDisplay({ confirmedCount: 4, participantLimit: 6 })).toMatchObject({ left: 2 });
    expect(placesDisplay({ confirmedCount: 7, participantLimit: 6 })).toEqual({
      kind: 'full',
      limit: 6,
    });
  });
});

describe('admin', () => {
  it('names the admin, or says the account was deleted', () => {
    expect(adminDisplay({ admin: { id: 'u1', displayName: 'Test Rider' } })).toEqual({
      kind: 'name',
      name: 'Test Rider',
    });
    expect(adminDisplay({ admin: null })).toEqual({ kind: 'deleted' });
    expect(adminDisplay({ admin: { id: 'u1', displayName: ' ' } })).toEqual({ kind: 'unnamed' });
  });
});

describe('distance', () => {
  it('shows a calculated distance from the route copy', () => {
    expect(
      distanceDisplay({ distanceMeters: 42_300, distanceIsPlanned: false, targetDistanceKm: null }),
    ).toEqual({ kind: 'calculated', meters: 42_300 });
  });

  it('shows a target distance as planned, never as calculated', () => {
    expect(
      distanceDisplay({ distanceMeters: 60_000, distanceIsPlanned: true, targetDistanceKm: 60 }),
    ).toEqual({ kind: 'planned', km: 60 });
    expect(
      distanceDisplay({ distanceMeters: null, distanceIsPlanned: true, targetDistanceKm: 59.6 }),
    ).toEqual({ kind: 'planned', km: 60 });
    expect(
      distanceDisplay({ distanceMeters: null, distanceIsPlanned: false, targetDistanceKm: null }),
    ).toEqual({ kind: 'none' });
  });
});

describe('meeting point and route', () => {
  const point = { lat: 49.6, lon: 6.1 };
  const area = { lat: 49.61, lon: 6.12, radiusMeters: 500 };
  const line = {
    type: 'LineString' as const,
    coordinates: [
      [6.1, 49.6],
      [6.2, 49.7],
    ] as [number, number][],
  };

  it('shows the exact point to the admin and participants', () => {
    for (const viewerRole of ['ADMIN', 'PARTICIPANT'] as ViewerRole[]) {
      expect(meetingDisplay({ viewerRole, meetingPoint: point, meetingArea: null })).toEqual({
        kind: 'exact',
        point,
      });
      expect(visibleRoute({ viewerRole, routeGeometry: line })).toBe(line);
    }
  });

  it('shows outsiders only the circle, even if an exact point were sent', () => {
    expect(meetingDisplay({ viewerRole: 'NONE', meetingPoint: null, meetingArea: area })).toEqual({
      kind: 'area',
      center: { lat: 49.61, lon: 6.12 },
      radiusMeters: 500,
    });
    expect(
      meetingDisplay({ viewerRole: 'NONE', meetingPoint: point, meetingArea: area }).kind,
    ).toBe('area');
    expect(meetingDisplay({ viewerRole: 'NONE', meetingPoint: point, meetingArea: null })).toEqual({
      kind: 'none',
    });
    expect(visibleRoute({ viewerRole: 'NONE', routeGeometry: line })).toBeNull();
  });

  it('shows nothing while a draft has no meeting point', () => {
    expect(meetingDisplay({ viewerRole: 'ADMIN', meetingPoint: null, meetingArea: null })).toEqual({
      kind: 'none',
    });
  });

  it('draws the area as a closed ring at the given radius', () => {
    const ring = circleRing({ lat: 49.6, lon: 6.1 }, 500, 32);
    expect(ring).toHaveLength(33);
    expect(ring[0]).toEqual(ring[32]);
    for (const position of ring) {
      expect(haversineMeters([6.1, 49.6], position)).toBeCloseTo(500, 0);
    }
  });
});

describe('admin actions', () => {
  const ride = (viewerRole: ViewerRole, status: RideStatus, past = false) => ({
    viewerRole,
    status,
    past,
  });

  it('lets the admin edit, publish and delete a draft', () => {
    expect(adminActions(ride('ADMIN', 'DRAFT'))).toEqual({
      edit: true,
      publish: true,
      cancel: false,
      delete: true,
    });
  });

  it('lets the admin edit and cancel a published ride', () => {
    expect(adminActions(ride('ADMIN', 'PUBLISHED'))).toEqual({
      edit: true,
      publish: false,
      cancel: true,
      delete: false,
    });
  });

  it('offers nothing to change once a ride is past or cancelled', () => {
    expect(adminActions(ride('ADMIN', 'PUBLISHED', true))).toEqual({
      edit: false,
      publish: false,
      cancel: false,
      delete: false,
    });
    expect(adminActions(ride('ADMIN', 'CANCELLED'))).toEqual({
      edit: false,
      publish: false,
      cancel: false,
      delete: false,
    });
  });

  it('lets the admin edit and delete a draft whose date has passed, but not publish it', () => {
    expect(adminActions(ride('ADMIN', 'DRAFT', true))).toEqual({
      edit: true,
      publish: false,
      cancel: false,
      delete: true,
    });
  });

  it('offers nothing to participants and outsiders', () => {
    for (const role of ['PARTICIPANT', 'NONE'] as ViewerRole[]) {
      expect(Object.values(adminActions(ride(role, 'PUBLISHED'))).some(Boolean)).toBe(false);
      expect(Object.values(adminActions(ride(role, 'DRAFT'))).some(Boolean)).toBe(false);
    }
  });
});
