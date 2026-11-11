import type { CalculatedRoute, Discipline, SavedRoute } from '@/api/routes';
import { boundsOf } from '@/planner/geo';
import { canUndo, createHistory, record, undo, type History } from '@/planner/history';
import {
  EMPTY_POINTS,
  pointsFromList,
  routeKey,
  type EditResult,
  type RoutePoints,
} from '@/planner/points';

export type Viewport = { center: [lon: number, lat: number]; zoom: number };

export type CameraRequest = {
  /** Increases with every request, so the same bounds can be requested twice */
  id: number;
  bounds: [west: number, south: number, east: number, north: number];
};

/**
 * The planner draft. Kept in memory only: it survives navigation and the app going to the
 * background, but it is never written to disk, because the points can reveal where a rider
 * lives. It is cleared on sign-out.
 */
export type PlannerState = {
  history: History<RoutePoints>;
  /** null until the rider picks one; the planner then uses the profile default */
  discipline: Discipline | null;
  /** The last calculated route and the request it belongs to (see `routeKey`) */
  route: { key: string; data: CalculatedRoute } | null;
  /** Set while editing a saved route */
  saved: { id: string; name: string; note: string } | null;
  /** Changes since the last save or since loading a saved route */
  dirty: boolean;
  /** Last map view, so the planner reopens where the rider left it */
  viewport: Viewport | null;
  camera: CameraRequest | null;
};

const initialState: PlannerState = {
  history: createHistory(EMPTY_POINTS),
  discipline: null,
  route: null,
  saved: null,
  dirty: false,
  viewport: null,
  camera: null,
};

/** The chosen discipline, else the first bicycle type in the profile, else road (spec). */
export function effectiveDiscipline(
  chosen: Discipline | null,
  bicycleTypes: readonly Discipline[] | undefined,
): Discipline {
  return chosen ?? bicycleTypes?.[0] ?? 'ROAD';
}

type Listener = () => void;

export function createPlannerStore() {
  let state = initialState;
  const listeners = new Set<Listener>();

  const set = (next: PlannerState) => {
    if (next === state) return;
    state = next;
    listeners.forEach((listener) => listener());
  };

  const cameraFor = (route: CalculatedRoute): CameraRequest | null => {
    const bounds = boundsOf(route.geometry.coordinates);
    return bounds ? { id: (state.camera?.id ?? 0) + 1, bounds } : null;
  };

  return {
    getState: () => state,

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    /** Applies a change to the points as one undo step. Returns the result (e.g. a limit). */
    edit(change: (points: RoutePoints) => EditResult | RoutePoints): EditResult {
      const outcome = change(state.history.present);
      const result: EditResult = 'ok' in outcome ? outcome : { ok: true, points: outcome };
      if (result.ok && result.points !== state.history.present) {
        set({ ...state, history: record(state.history, result.points), dirty: true });
      }
      return result;
    },

    undo(): void {
      if (!canUndo(state.history)) return;
      set({ ...state, history: undo(state.history), dirty: true });
    },

    setDiscipline(discipline: Discipline): void {
      if (discipline === state.discipline) return;
      set({ ...state, discipline, dirty: true });
    },

    setRoute(key: string, data: CalculatedRoute): void {
      set({ ...state, route: { key, data } });
    },

    setViewport(viewport: Viewport): void {
      set({ ...state, viewport });
    },

    /** The map has moved to the requested bounds; later visits start from the last view. */
    cameraDone(id: number): void {
      if (state.camera?.id !== id) return;
      set({ ...state, camera: null });
    },

    /** Opens a saved route: its stored geometry is shown as is, without recalculating. */
    loadSaved(route: SavedRoute): void {
      const points = pointsFromList(route.points);
      const key = routeKey(points, route.discipline);
      set({
        ...state,
        history: createHistory(points),
        discipline: route.discipline,
        route: key ? { key, data: route } : null,
        saved: { id: route.id, name: route.name, note: route.note ?? '' },
        dirty: false,
        camera: cameraFor(route),
      });
    },

    /** After a successful save. The server recalculated, so its result becomes the route. */
    markSaved(route: SavedRoute): void {
      const key = routeKey(state.history.present, route.discipline);
      set({
        ...state,
        route: key ? { key, data: route } : state.route,
        saved: { id: route.id, name: route.name, note: route.note ?? '' },
        dirty: false,
      });
    },

    /** After a rename from the list: keeps the draft in sync with the server. */
    renamed(id: string, name: string, note: string): void {
      if (state.saved?.id !== id) return;
      set({ ...state, saved: { id, name, note } });
    },

    /** The saved route was deleted: the draft stays, but as a new, unsaved route. */
    forgetSaved(id: string): void {
      if (state.saved?.id !== id) return;
      set({ ...state, saved: null, dirty: true });
    },

    /** Starts a new route; keeps the map view and the discipline. */
    startNew(): void {
      set({
        ...initialState,
        discipline: state.discipline,
        viewport: state.viewport,
      });
    },

    /** Forgets everything (sign-out). */
    reset(): void {
      set(initialState);
    },
  };
}

export type PlannerStore = ReturnType<typeof createPlannerStore>;

/** The app's planner draft. */
export const plannerStore = createPlannerStore();
