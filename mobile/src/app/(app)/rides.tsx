import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { RideSummary } from '@/api/rides';
import { ridesClient } from '@/api/ridesClient';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Badge } from '@/components/rides/Badge';
import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';
import { distanceDisplay, rideBadge, sortRides } from '@/rides/display';
import { rideErrorMessage } from '@/rides/rideErrors';
import { ageRatingLabel, ageRatingText, distanceText, rideWhenText } from '@/rides/rideText';

type ListState =
  | { kind: 'loading' }
  | { kind: 'loaded'; rides: RideSummary[] }
  | { kind: 'failed'; error: unknown };

/** Rides the rider admins or joined: upcoming first, then past and cancelled ones. */
export default function RidesScreen() {
  const { t } = useTranslation();
  const [list, setList] = useState<ListState>({ kind: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setList({ kind: 'loaded', rides: sortRides(await ridesClient.listMine()) });
    } catch (error) {
      setList({ kind: 'failed', error });
    }
  }, []);

  // Reload whenever the screen comes back into view (after creating, editing or cancelling)
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

  const create = () => router.push('/ride-form');

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
        <FormMessage message={rideErrorMessage(list.error)} />
        <Button
          variant="secondary"
          label={t('rides.retry')}
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
      data={list.rides}
      keyExtractor={(ride) => ride.id}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />
      }
      ListHeaderComponent={
        <Button
          label={t('rides.create')}
          accessibilityHint={t('rides.createHint')}
          onPress={create}
        />
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={styles.muted}>{t('rides.empty')}</Text>
        </View>
      }
      renderItem={({ item }) => <RideRow ride={item} />}
    />
  );
}

function RideRow({ ride }: { ride: RideSummary }) {
  const { t } = useTranslation();
  const badge = rideBadge(ride);
  const when = rideWhenText(ride);
  const details = [
    ride.discipline ? t(`profile.bicycleTypes.${ride.discipline}`) : null,
    distanceText(distanceDisplay(ride)),
    ride.participantLimit !== null
      ? t('rides.participants', { confirmed: ride.confirmedCount, limit: ride.participantLimit })
      : null,
  ]
    .filter((part): part is string => part !== null)
    .join(t('rides.separator'));
  const badges = [
    badge ? t(`rides.badge.${badge}`) : null,
    ride.ageRating ? ageRatingLabel(ride.ageRating) : null,
  ]
    .filter((part): part is string => part !== null)
    .join(t('rides.labelSeparator'));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('rides.rowLabel', { name: ride.name, when, details, badges })}
      accessibilityHint={t('rides.openHint')}
      onPress={() => router.push({ pathname: '/ride/[id]', params: { id: ride.id } })}
      style={({ pressed }) => [
        styles.row,
        badge === 'past' || badge === 'cancelled' ? styles.ended : null,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.badges}>
        {badge ? (
          <Badge
            text={t(`rides.badge.${badge}`)}
            tone={badge === 'cancelled' ? 'danger' : badge === 'draft' ? 'accent' : 'neutral'}
          />
        ) : null}
        {ride.ageRating ? <Badge text={ageRatingText(ride.ageRating)} /> : null}
        {ride.viewerRole === 'ADMIN' ? <Badge text={t('rides.role.ADMIN')} /> : null}
      </View>
      <Text style={styles.name}>{ride.name}</Text>
      <Text style={styles.when}>{when}</Text>
      {details ? <Text style={styles.muted}>{details}</Text> : null}
    </Pressable>
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
    paddingTop: 40,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: 12,
    gap: 4,
  },
  ended: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.8,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  name: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  when: {
    color: colors.text,
    fontSize: 14,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 14,
  },
});
