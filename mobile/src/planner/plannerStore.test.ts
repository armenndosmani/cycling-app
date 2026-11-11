import { describe, expect, it, vi } from 'vitest';

import type { CalculatedRoute, SavedRoute } from '@/api/routes';
import { createPlannerStore, effectiveDiscipline } from '@/planner/plannerStore';
import { addPoint, createPoint, routeKey } from '@/planner/points';

const route: CalculatedRoute = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [6.1, 49.6],
      [6.3, 49.8],
    ],
  },
  distanceMeters: 30_000,
  ascendMeters: null,
  elevationProfile: [],
  surfaces: [],
};

const saved: SavedRoute = {
  ...route,
  id: 'r1',
  name: 'Fake loop',
  note: null,
  discipline: 'MTB',
  points: [
    { lat: 49.6, lon: 6.1 },
    { lat: 49.7, lon: 6.2 },
    { lat: 49.8, lon: 6.3 },
  ],
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

describe('effectiveDiscipline', () => {
  it('uses the choice, else the first bicycle type, else road', () => {
    expect(effectiveDiscipline('MTB', ['GRAVEL'])).toBe('MTB');
    expect(effectiveDiscipline(null, ['GRAVEL', 'ROAD'])).toBe('GRAVEL');
    expect(effectiveDiscipline(null, [])).toBe('ROAD');
    expect(effectiveDiscipline(null, undefined)).toBe('ROAD');
  });
});

describe('plannerStore', () => {
  it('records edits as undo steps and notifies listeners', () => {
    const store = createPlannerStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.edit((points) => addPoint(points, createPoint({ lat: 1, lon: 1 })));
    store.edit((points) => addPoint(points, createPoint({ lat: 2, lon: 2 })));
    expect(store.getState().history.present.destination).not.toBeNull();
    expect(store.getState().dirty).toBe(true);
    expect(listener).toHaveBeenCalledTimes(2);

    store.undo();
    expect(store.getState().history.present.destination).toBeNull();
    expect(store.getState().history.present.start).not.toBeNull();
  });

  it('does not record a failed edit', () => {
    const store = createPlannerStore();
    const before = store.getState();
    const result = store.edit(() => ({ ok: false, reason: 'waypointLimit' }));
    expect(result.ok).toBe(false);
    expect(store.getState()).toBe(before);
  });

  it('opens a saved route with its stored result, so nothing is recalculated', () => {
    const store = createPlannerStore();
    store.loadSaved(saved);
    const state = store.getState();
    expect(state.dirty).toBe(false);
    expect(state.discipline).toBe('MTB');
    expect(state.history.present.waypoints).toHaveLength(1);
    expect(state.route?.key).toBe(routeKey(state.history.present, 'MTB'));
    expect(state.saved).toEqual({ id: 'r1', name: 'Fake loop', note: '' });
    expect(state.camera?.bounds).toEqual([6.1, 49.6, 6.3, 49.8]);
    store.cameraDone(state.camera!.id + 1);
    expect(store.getState().camera).not.toBeNull();
    store.cameraDone(state.camera!.id);
    expect(store.getState().camera).toBeNull();
  });

  it('tracks saving, renaming and deleting the saved route', () => {
    const store = createPlannerStore();
    store.loadSaved(saved);
    store.setDiscipline('ROAD');
    expect(store.getState().dirty).toBe(true);

    store.markSaved({ ...saved, discipline: 'ROAD', name: 'New name' });
    expect(store.getState().dirty).toBe(false);
    expect(store.getState().saved?.name).toBe('New name');

    store.renamed('other', 'x', '');
    expect(store.getState().saved?.name).toBe('New name');
    store.renamed('r1', 'Renamed', 'note');
    expect(store.getState().saved).toEqual({ id: 'r1', name: 'Renamed', note: 'note' });

    store.forgetSaved('r1');
    expect(store.getState().saved).toBeNull();
    expect(store.getState().dirty).toBe(true);
  });

  it('starts a new route keeping the view, and resets completely on sign-out', () => {
    const store = createPlannerStore();
    store.loadSaved(saved);
    store.setViewport({ center: [6, 49], zoom: 10 });
    store.startNew();
    expect(store.getState().history.present.start).toBeNull();
    expect(store.getState().viewport).toEqual({ center: [6, 49], zoom: 10 });
    expect(store.getState().discipline).toBe('MTB');

    store.reset();
    expect(store.getState().viewport).toBeNull();
    expect(store.getState().discipline).toBeNull();
  });
});
