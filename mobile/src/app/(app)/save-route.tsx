import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { routesClient } from '@/api/routesClient';
import { useAuth } from '@/auth/AuthProvider';
import { RouteDetailsForm } from '@/components/planner/RouteDetailsForm';
import { Screen } from '@/components/Screen';
import { effectiveDiscipline, plannerStore } from '@/planner/plannerStore';
import { routeKey, routeRequestPoints } from '@/planner/points';
import { usePlannerState } from '@/planner/usePlanner';

/** Saves the planner draft as a private route: a new one, or the saved route being edited. */
export default function SaveRouteScreen() {
  const { t } = useTranslation();
  const { me } = useAuth();
  const state = usePlannerState();
  const points = state.history.present;
  const discipline = effectiveDiscipline(state.discipline, me?.bicycleTypes);
  const requestPoints = routeRequestPoints(points);
  const ready = requestPoints !== null && state.route?.key === routeKey(points, discipline);

  const save = async (name: string, note: string) => {
    if (!requestPoints) return;
    const body = { name, note, discipline, points: requestPoints };
    const saved = state.saved
      ? await routesClient.updateRoute(state.saved.id, body)
      : await routesClient.createRoute(body);
    plannerStore.markSaved(saved);
    router.back();
  };

  return (
    <Screen intro={t('routeDetails.intro')}>
      <RouteDetailsForm
        initialName={state.saved?.name ?? ''}
        initialNote={state.saved?.note ?? ''}
        onSubmit={save}
        blocker={ready ? undefined : t('routeDetails.notReady')}
      />
    </Screen>
  );
}
