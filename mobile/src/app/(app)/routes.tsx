import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import type { SavedRouteSummary } from '@/api/routes';
import { routesClient } from '@/api/routesClient';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';
import { confirmDiscard } from '@/planner/confirmDiscard';
import { formatKilometres, roundMeters } from '@/planner/format';
import { plannerStore } from '@/planner/plannerStore';

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; routes: SavedRouteSummary[] }
  | { kind: 'failed'; error: unknown };

/** The rider's saved routes (private drafts), newest first. */
export default function RoutesScreen() {
  const { t } = useTranslation();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string>();

  const load = useCallback(async () => {
    try {
      setList({ kind: 'loaded', routes: await routesClient.listRoutes() });
    } catch (error) {
      setList({ kind: 'failed', error });
    }
  }, []);

  // Reload whenever the screen comes back into view (e.g. after renaming or saving)
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const open = (summary: SavedRouteSummary) => {
    // Already open in the planner: just go back to it
    if (plannerStore.getState().saved?.id === summary.id) {
      router.dismissTo('/planner');
      return;
    }
    confirmDiscard(async () => {
      setActionError(undefined);
      setBusyId(summary.id);
      try {
        plannerStore.loadSaved(await routesClient.getRoute(summary.id));
        router.dismissTo('/planner');
      } catch (error) {
        setActionError(errorMessage(error));
      } finally {
        setBusyId(null);
      }
    });
  };

  const remove = (summary: SavedRouteSummary) => {
    Alert.alert(t('routes.deleteTitle'), t('routes.deleteMessage', { name: summary.name }), [
      { text: t('routes.cancel'), style: 'cancel' },
      {
        text: t('routes.deleteConfirm'),
        style: 'destructive',
        onPress: async () => {
          setActionError(undefined);
          setBusyId(summary.id);
          try {
            await routesClient.deleteRoute(summary.id);
            plannerStore.forgetSaved(summary.id);
            setList((current) =>
              current.kind === 'loaded'
                ? { kind: 'loaded', routes: current.routes.filter((r) => r.id !== summary.id) }
                : current,
            );
          } catch (error) {
            setActionError(errorMessage(error));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
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
          label={t('routes.retry')}
          onPress={() => {
            setList({ kind: 'loading' });
            void load();
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
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={<FormMessage message={actionError} />}
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.muted}>{t('routes.empty')}</Text>
          <Button label={t('routes.planFirst')} onPress={() => router.dismissTo('/planner')} />
        </View>
      }
      renderItem={({ item }) => (
        <RouteRow
          route={item}
          busy={busyId === item.id}
          onOpen={() => open(item)}
          onRename={() => router.push({ pathname: '/rename-route', params: { id: item.id } })}
          onDelete={() => remove(item)}
        />
      )}
    />
  );
}

type RowProps = {
  route: SavedRouteSummary;
  busy: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
};

function RouteRow({ route, busy, onOpen, onRename, onDelete }: RowProps) {
  const { t } = useTranslation();
  const summary = t('routes.summary', {
    discipline: t(`profile.bicycleTypes.${route.discipline}`),
    distance: t('planner.stats.distanceValue', { km: formatKilometres(route.distanceMeters) }),
    ascend:
      route.ascendMeters === null
        ? t('planner.stats.elevationUnavailable')
        : t('planner.stats.ascendValue', { meters: roundMeters(route.ascendMeters) }),
  });

  return (
    <View style={styles.row}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('routes.rowLabel', { name: route.name, summary })}
        accessibilityHint={t('routes.openHint')}
        accessibilityState={{ busy }}
        onPress={onOpen}
        disabled={busy}
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}
      >
        <Text style={styles.name}>{route.name}</Text>
        <Text style={styles.muted}>{summary}</Text>
        {busy ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('routes.opening')} />
        ) : null}
      </Pressable>
      <View style={styles.rowActions}>
        <Button
          variant="link"
          label={t('routes.rename')}
          accessibilityLabel={t('routes.renameLabel', { name: route.name })}
          onPress={onRename}
          disabled={busy}
        />
        <Button
          variant="link"
          label={t('routes.delete')}
          accessibilityLabel={t('routes.deleteLabel', { name: route.name })}
          onPress={onDelete}
          disabled={busy}
        />
      </View>
    </View>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: colors.background,
  },
  empty: {
    alignItems: 'center',
    gap: 16,
    paddingTop: 40,
  },
  row: {
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  open: {
    minHeight: MIN_TOUCH_TARGET,
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
  rowActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 16,
  },
});
