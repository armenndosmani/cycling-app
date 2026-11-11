import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator } from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import type { SavedRoute } from '@/api/routes';
import { routesClient } from '@/api/routesClient';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { RouteDetailsForm } from '@/components/planner/RouteDetailsForm';
import { Screen } from '@/components/Screen';
import { colors } from '@/constants/theme';
import { plannerStore } from '@/planner/plannerStore';

type Loaded =
  { kind: 'loading' } | { kind: 'loaded'; route: SavedRoute } | { kind: 'failed'; error: unknown };

/** Changes the name and note of a saved route. Its points and discipline stay the same. */
export default function RenameRouteScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    routesClient
      .getRoute(id)
      .then((route) => {
        if (!cancelled) setLoaded({ kind: 'loaded', route });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoaded({ kind: 'failed', error });
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt]);

  const save = async (name: string, note: string) => {
    if (loaded.kind !== 'loaded') return;
    const { route } = loaded;
    const updated = await routesClient.updateRoute(route.id, {
      name,
      note,
      discipline: route.discipline,
      points: route.points,
    });
    plannerStore.renamed(updated.id, updated.name, updated.note ?? '');
    router.back();
  };

  return (
    <Screen>
      {loaded.kind === 'loading' ? (
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
      ) : null}
      {loaded.kind === 'failed' ? (
        <>
          <FormMessage message={t('routeDetails.loadFailed')} />
          <FormMessage message={errorMessage(loaded.error)} />
          <Button
            variant="secondary"
            label={t('routes.retry')}
            onPress={() => {
              setLoaded({ kind: 'loading' });
              setAttempt((n) => n + 1);
            }}
          />
        </>
      ) : null}
      {loaded.kind === 'loaded' ? (
        <RouteDetailsForm
          initialName={loaded.route.name}
          initialNote={loaded.route.note ?? ''}
          onSubmit={save}
        />
      ) : null}
    </Screen>
  );
}
