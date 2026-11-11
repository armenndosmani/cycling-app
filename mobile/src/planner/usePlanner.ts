import { useEffect, useState, useSyncExternalStore } from 'react';

import type { CalculatedRoute, Discipline } from '@/api/routes';
import { routesClient } from '@/api/routesClient';
import { LatestRequest } from '@/planner/latestRequest';
import { plannerStore, type PlannerState } from '@/planner/plannerStore';
import { routeKey, routeRequestPoints, type RoutePoints } from '@/planner/points';

/** Waits briefly after a change, so a burst of edits sends one request. */
const RECALCULATE_DELAY_MS = 250;

export function usePlannerState(): PlannerState {
  return useSyncExternalStore(plannerStore.subscribe, plannerStore.getState);
}
export type CalculationStatus =
  | { kind: 'incomplete' }
  | { kind: 'ready' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown };

export type RouteCalculation = {
  status: CalculationStatus;
  /** The route to draw: the current one, or the previous one while a new one is calculating */
  route: CalculatedRoute | null;
  /** True while `route` belongs to earlier points (shown dimmed) */
  outdated: boolean;
  retry: () => void;
};

/**
 * Calculates the route whenever the points or the discipline change, without an extra tap.
 * Only the newest request counts: older ones are aborted and their answers ignored.
 */
export function useRouteCalculation(
  points: RoutePoints,
  discipline: Discipline,
  stored: PlannerState['route'],
): RouteCalculation {
  const key = routeKey(points, discipline);
  const [latest] = useState(() => new LatestRequest());
  const [failure, setFailure] = useState<{ key: string; error: unknown } | null>(null);
  const upToDate = key !== null && stored?.key === key;
  const failed = key !== null && failure?.key === key;

  useEffect(() => {
    const request = routeRequestPoints(points);
    if (!key || !request || upToDate || failed) return;
    const timer = setTimeout(() => {
      latest
        .run((signal) => routesClient.calculateRoute(discipline, request, signal))
        .then((result) => {
          if (!result.stale) plannerStore.setRoute(key, result.value);
        })
        .catch((error: unknown) => setFailure({ key, error }));
    }, RECALCULATE_DELAY_MS);
    return () => {
      clearTimeout(timer);
      // The points changed: whatever is still running is outdated
      latest.cancel();
    };
  }, [key, upToDate, failed, points, discipline, latest]);

  const status: CalculationStatus = !key
    ? { kind: 'incomplete' }
    : upToDate
      ? { kind: 'ready' }
      : failed
        ? { kind: 'error', error: failure.error }
        : { kind: 'loading' };

  return {
    status,
    route: stored && (status.kind === 'ready' || status.kind === 'loading') ? stored.data : null,
    outdated: !upToDate,
    retry: () => setFailure(null),
  };
}
