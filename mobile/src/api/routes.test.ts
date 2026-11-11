import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/ApiError';
import type { RequestOptions } from '@/api/client';
import { PROBLEM_TYPES } from '@/api/problem';
import {
  InvalidResponseError,
  parseCalculatedRoute,
  parsePlaces,
  parseSavedRoute,
  routeFailure,
  routesApi,
  validateRouteDetails,
} from '@/api/routes';

// Fake data only
const calculated = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [6.1, 49.6, 300],
      [6.2, 49.7, 320],
    ],
  },
  distanceMeters: 12_345,
  ascendMeters: 87.6,
  elevationProfile: [
    [0, 300],
    [12_345, 320],
  ],
  surfaces: [{ surface: 'asphalt', meters: 12_345 }],
};

const saved = {
  ...calculated,
  id: 'r1',
  name: 'Test loop',
  note: null,
  discipline: 'GRAVEL',
  points: [
    { lat: 49.6, lon: 6.1 },
    { lat: 49.7, lon: 6.2 },
  ],
  createdAt: '2026-11-01T10:00:00Z',
  updatedAt: '2026-11-02T10:00:00Z',
};

function apiWith(response: unknown) {
  const send = vi.fn(async (_path: string, _options?: RequestOptions) => response);
  return { api: routesApi(send as never), send };
}

describe('parsing', () => {
  it('parses a calculated route', () => {
    expect(parseCalculatedRoute(calculated)).toEqual(calculated);
  });

  it('accepts missing elevation as null and missing lists as empty', () => {
    const route = parseCalculatedRoute({
      geometry: {
        type: 'LineString',
        coordinates: [
          [6.1, 49.6],
          [6.2, 49.7],
        ],
      },
      distanceMeters: 100,
      ascendMeters: null,
    });
    expect(route.ascendMeters).toBeNull();
    expect(route.elevationProfile).toEqual([]);
    expect(route.surfaces).toEqual([]);
  });

  it('rejects responses that break the contract', () => {
    expect(() => parseCalculatedRoute(null)).toThrow(InvalidResponseError);
    expect(() => parseCalculatedRoute({ ...calculated, distanceMeters: '12' })).toThrow(
      InvalidResponseError,
    );
    expect(() =>
      parseCalculatedRoute({ ...calculated, geometry: { type: 'Point', coordinates: [1, 2] } }),
    ).toThrow(InvalidResponseError);
  });

  it('parses places and saved routes', () => {
    expect(
      parsePlaces([{ name: 'Fake Town', label: 'Fake Town, Nowhere', lat: 1, lon: 2 }]),
    ).toEqual([{ name: 'Fake Town', label: 'Fake Town, Nowhere', lat: 1, lon: 2 }]);
    const route = parseSavedRoute(saved);
    expect(route.discipline).toBe('GRAVEL');
    expect(route.note).toBeNull();
    expect(route.points).toHaveLength(2);
    expect(() => parseSavedRoute({ ...saved, discipline: 'TANDEM' })).toThrow(InvalidResponseError);
  });
});

describe('routesApi', () => {
  it('posts the discipline and points for calculation', async () => {
    const { api, send } = apiWith(calculated);
    const signal = new AbortController().signal;
    await api.calculateRoute(
      'ROAD',
      [{ lat: 1, lon: 2, id: 'x' } as never, { lat: 3, lon: 4 }],
      signal,
    );
    const [path, options] = send.mock.calls[0];
    expect(path).toBe('/api/routing/route');
    expect(options?.method).toBe('POST');
    expect(options?.signal).toBe(signal);
    expect(options?.body).toEqual({
      discipline: 'ROAD',
      points: [
        { lat: 1, lon: 2 },
        { lat: 3, lon: 4 },
      ],
    });
  });

  it('searches places near a point', async () => {
    const { api, send } = apiWith([]);
    await api.searchPlaces(' Fake Town ', { lat: 49.61234, lon: 6.13456 });
    expect(send.mock.calls[0][0]).toBe('/api/places?q=Fake+Town&lat=49.6123&lon=6.1346');
  });

  it('lists routes newest first', async () => {
    const summary = (id: string, updatedAt: string) => ({
      id,
      name: id,
      discipline: 'ROAD',
      distanceMeters: 1,
      ascendMeters: null,
      updatedAt,
    });
    const { api } = apiWith([
      summary('old', '2026-01-01T00:00:00Z'),
      summary('new', '2026-03-01T00:00:00Z'),
      summary('mid', '2026-02-01T00:00:00Z'),
    ]);
    expect((await api.listRoutes()).map((r) => r.id)).toEqual(['new', 'mid', 'old']);
  });

  it('trims name and note and leaves out an empty note', async () => {
    const { api, send } = apiWith(saved);
    await api.updateRoute('r 1', {
      name: '  Test loop ',
      note: '   ',
      discipline: 'GRAVEL',
      points: saved.points,
    });
    const [path, options] = send.mock.calls[0];
    expect(path).toBe('/api/routes/r%201');
    expect(options?.method).toBe('PUT');
    expect(options?.body).toEqual({
      name: 'Test loop',
      discipline: 'GRAVEL',
      points: saved.points,
    });
  });

  it('deletes a route', async () => {
    const { api, send } = apiWith(undefined);
    await api.deleteRoute('r1');
    expect(send).toHaveBeenCalledWith('/api/routes/r1', { method: 'DELETE' });
  });
});

describe('routeFailure', () => {
  it('maps the route problems', () => {
    expect(routeFailure(new ApiError('http', 422, { type: PROBLEM_TYPES.routeNotFound }))).toBe(
      'notFound',
    );
    expect(
      routeFailure(new ApiError('http', 503, { type: PROBLEM_TYPES.routingUnavailable })),
    ).toBe('unavailable');
    expect(routeFailure(new ApiError('http', 503))).toBe('unavailable');
    expect(routeFailure(new ApiError('network'))).toBe('other');
    expect(routeFailure(new ApiError('http', 500))).toBe('other');
    expect(routeFailure(new Error('x'))).toBe('other');
  });
});

describe('validateRouteDetails', () => {
  it('requires a name of 1 to 80 characters and a note up to 1000', () => {
    expect(validateRouteDetails('Ride', '')).toBeUndefined();
    expect(validateRouteDetails('   ', '')).toEqual({ name: 'required' });
    expect(validateRouteDetails('x'.repeat(81), '')).toEqual({ name: 'tooLong' });
    expect(validateRouteDetails('x'.repeat(80), 'y'.repeat(1000))).toBeUndefined();
    expect(validateRouteDetails('Ride', 'y'.repeat(1001))).toEqual({ note: 'tooLong' });
  });
});
