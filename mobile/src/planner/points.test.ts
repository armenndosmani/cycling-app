import { describe, expect, it } from 'vitest';

import {
  addPoint,
  bestInsertIndex,
  createPoint,
  EMPTY_POINTS,
  insertWaypoint,
  listPoints,
  makeLoop,
  MAX_WAYPOINTS,
  movePoint,
  pointsFromList,
  removePoint,
  reorderWaypoint,
  routeKey,
  routeRequestPoints,
  type EditResult,
  type RoutePoints,
} from '@/planner/points';

// Fake coordinates on a line of longitude; nothing here is a real person's location
const at = (lon: number, name?: string) => createPoint({ lat: 50, lon }, name);

function applied(result: EditResult): RoutePoints {
  if (!result.ok) throw new Error(`edit failed: ${result.reason}`);
  return result.points;
}

function withEnds(): RoutePoints {
  return { start: at(0), waypoints: [], destination: at(10) };
}

describe('addPoint', () => {
  it('sets the start, then the destination, then adds waypoints', () => {
    let points = applied(addPoint(EMPTY_POINTS, at(0)));
    expect(points.start?.lon).toBe(0);
    expect(routeRequestPoints(points)).toBeNull();

    points = applied(addPoint(points, at(10)));
    expect(points.destination?.lon).toBe(10);
    expect(routeRequestPoints(points)).toEqual([
      { lat: 50, lon: 0 },
      { lat: 50, lon: 10 },
    ]);

    points = applied(addPoint(points, at(5)));
    expect(points.waypoints.map((p) => p.lon)).toEqual([5]);
  });

  it('inserts a waypoint between the points where it fits best', () => {
    let points = withEnds();
    points = applied(addPoint(points, at(8)));
    points = applied(addPoint(points, at(2)));
    points = applied(addPoint(points, at(5)));
    expect(points.waypoints.map((p) => p.lon)).toEqual([2, 5, 8]);
  });

  it('refuses more than 25 waypoints', () => {
    let points = withEnds();
    for (let i = 0; i < MAX_WAYPOINTS; i += 1) {
      points = applied(insertWaypoint(points, at(i * 0.1)));
    }
    expect(points.waypoints).toHaveLength(25);
    expect(addPoint(points, at(3))).toEqual({ ok: false, reason: 'waypointLimit' });
    expect(routeRequestPoints(points)).toHaveLength(27);
  });
});

describe('bestInsertIndex', () => {
  it('appends when there is only a start', () => {
    const points: RoutePoints = { start: at(0), waypoints: [at(1)], destination: null };
    expect(bestInsertIndex(points, { lat: 50, lon: 2 })).toBe(1);
  });

  it('handles a missing start', () => {
    const points: RoutePoints = { start: null, waypoints: [at(1), at(3)], destination: at(5) };
    expect(bestInsertIndex(points, { lat: 50, lon: 4 })).toBe(2);
  });
});

describe('editing points', () => {
  it('moves a point and drops its place name', () => {
    const named = { ...withEnds(), start: at(0, 'Fake Square') };
    const moved = movePoint(named, named.start!.id, { lat: 51, lon: 1 });
    expect(moved.start).toEqual({ id: named.start!.id, lat: 51, lon: 1 });
    expect(moved.destination).toBe(named.destination);
  });

  it('removes waypoints, start and destination', () => {
    const points = applied(addPoint(withEnds(), at(5)));
    const waypointId = points.waypoints[0].id;
    expect(removePoint(points, waypointId).waypoints).toEqual([]);
    expect(removePoint(points, points.start!.id).start).toBeNull();
    expect(removePoint(points, points.destination!.id).destination).toBeNull();
  });

  it('reorders waypoints within bounds', () => {
    let points = withEnds();
    points = applied(insertWaypoint(points, at(1), 0));
    points = applied(insertWaypoint(points, at(2), 1));
    const [first, second] = points.waypoints;
    expect(reorderWaypoint(points, second.id, -1).waypoints).toEqual([second, first]);
    expect(reorderWaypoint(points, first.id, -1)).toBe(points);
    expect(reorderWaypoint(points, second.id, 1)).toBe(points);
  });

  it('makes a loop back to the start', () => {
    const start = at(0, 'Fake Park');
    const loop = makeLoop({ start, waypoints: [], destination: null });
    expect(loop.destination).toMatchObject({ lat: 50, lon: 0, name: 'Fake Park' });
    expect(loop.destination?.id).not.toBe(start.id);
    expect(makeLoop(EMPTY_POINTS)).toBe(EMPTY_POINTS);
  });

  it('lists points in route order with roles', () => {
    const points = applied(addPoint(withEnds(), at(5)));
    expect(listPoints(points).map(({ role, index }) => [role, index])).toEqual([
      ['start', 0],
      ['waypoint', 0],
      ['destination', 0],
    ]);
  });
});

describe('routeKey and saved points', () => {
  it('changes with discipline and points', () => {
    const points = withEnds();
    expect(routeKey(EMPTY_POINTS, 'ROAD')).toBeNull();
    expect(routeKey(points, 'ROAD')).not.toBe(routeKey(points, 'MTB'));
    const moved = movePoint(points, points.start!.id, { lat: 50, lon: 0.5 });
    expect(routeKey(moved, 'ROAD')).not.toBe(routeKey(points, 'ROAD'));
  });

  it('rebuilds start, waypoints and destination from a list', () => {
    const points = pointsFromList([
      { lat: 50, lon: 0 },
      { lat: 50, lon: 1 },
      { lat: 50, lon: 0 },
    ]);
    expect(points.start).toMatchObject({ lon: 0 });
    expect(points.waypoints).toHaveLength(1);
    expect(points.destination).toMatchObject({ lon: 0 });
    expect(pointsFromList([{ lat: 1, lon: 1 }])).toBe(EMPTY_POINTS);
  });
});
