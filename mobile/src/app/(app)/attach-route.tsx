import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import type { SavedRouteSummary } from '@/api/routes';
import { routesClient } from '@/api/routesClient';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';
import { formatKilometres } from '@/planner/format';
import { attachRoute } from '@/rides/rideForm';
import { rideFormStore } from '@/rides/rideFormStore';

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; routes: SavedRouteSummary[] }
  | { kind: 'failed'; error: unknown };

/** Chooses a saved route for the ride. The ride gets its own copy when it is saved. */
export default function AttachRouteScreen() {
  const { t } = useTranslation();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    routesClient
      .listRoutes()
      .then((routes) => {
        if (!cancelled) setList({ kind: 'loaded', routes });
      })
      .catch((error: unknown) => {
        if (!cancelled) setList({ kind: 'failed', error });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const choose = async (summary: SavedRouteSummary) => {
    setActionError(undefined);
    setBusyId(summary.id);
    try {
      const route = await routesClient.getRoute(summary.id);
      rideFormStore.update((form) => attachRoute(form, route));
      router.back();
    } catch (error) {
      setActionError(errorMessage(error));
      setBusyId(null);
    }
  };

  if (list.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  if (list.kind === 'failed') {
    return (
      <View style={styles.centered}>
        <FormMessage message={errorMessage(list.error)} />
        <Button
          variant="secondary"
          label={t('rides.retry')}
          onPress={() => {
            setList({ kind: 'loading' });
            setAttempt((n) => n + 1);
          }}
        />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      contentContainerStyle={styles.content}
      data={list.routes}
      keyExtractor={(route) => route.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.muted}>{t('rides.attachRoute.intro')}</Text>
          <FormMessage message={actionError} />
        </View>
      }
      ListEmptyComponent={<Text style={styles.muted}>{t('rides.attachRoute.empty')}</Text>}
      renderItem={({ item }) => {
        const summary = t('routes.summary', {
          discipline: t(`profile.bicycleTypes.${item.discipline}`),
          distance: t('planner.stats.distanceValue', { km: formatKilometres(item.distanceMeters) }),
          ascend:
            item.ascendMeters === null
              ? t('planner.stats.elevationUnavailable')
              : t('planner.stats.ascendValue', { meters: Math.round(item.ascendMeters) }),
        });
        const busy = busyId === item.id;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('routes.rowLabel', { name: item.name, summary })}
            accessibilityHint={t('rides.attachRoute.hint')}
            accessibilityState={{ busy, disabled: busyId !== null }}
            disabled={busyId !== null}
            onPress={() => void choose(item)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.muted}>{summary}</Text>
            {busy ? <ActivityIndicator color={colors.accent} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    gap: 12,
    padding: 16,
  },
  header: {
    gap: 8,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: colors.background,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  pressed: {
    opacity: 0.8,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
