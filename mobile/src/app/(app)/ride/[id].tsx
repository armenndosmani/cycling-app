import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';

import type { Ride } from '@/api/rides';
import { rideFailure } from '@/api/rides';
import { ridesClient } from '@/api/ridesClient';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { ElevationProfile } from '@/components/planner/ElevationProfile';
import { Surfaces } from '@/components/planner/RouteSummary';
import { Screen } from '@/components/Screen';
import { Badge } from '@/components/rides/Badge';
import { RideMap } from '@/components/rides/RideMap';
import { colors } from '@/constants/theme';
import { roundMeters } from '@/planner/format';
import { positionAtFraction } from '@/planner/geo';
import { withAdultConfirmation } from '@/rides/adultConfirmation';
import {
  adminActions,
  distanceDisplay,
  meetingDisplay,
  rideBadge,
  visibleRoute,
} from '@/rides/display';
import { rideErrorMessage } from '@/rides/rideErrors';
import { ageRatingLabel, ageRatingText, distanceText, rideWhenText } from '@/rides/rideText';

type Loaded =
  { kind: 'loading' } | { kind: 'loaded'; ride: Ride } | { kind: 'failed'; error: unknown };

/** All key facts of a ride, its map and, for the admin, edit, publish, cancel and delete. */
export default function RideScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { reloadMe } = useAuth();
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [busy, setBusy] = useState<'publish' | 'delete' | null>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' }>();
  const [selected, setSelected] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      setLoaded({ kind: 'loaded', ride: await ridesClient.getRide(id) });
    } catch (error) {
      setLoaded({ kind: 'failed', error });
    }
  }, [id]);

  // Reload when coming back from editing or cancelling
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loaded.kind === 'loading') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
      </View>
    );
  }

  if (loaded.kind === 'failed') {
    return (
      <View style={styles.centered}>
        <FormMessage message={rideErrorMessage(loaded.error)} />
        <Button
          variant="secondary"
          label={t('rides.retry')}
          onPress={() => {
            setLoaded({ kind: 'loading' });
            void load();
          }}
        />
      </View>
    );
  }

  const { ride } = loaded;
  const actions = adminActions(ride);
  const badge = rideBadge(ride);
  const meeting = meetingDisplay(ride);
  const route = visibleRoute(ride);
  const profile = ride.elevationProfile;
  const highlight =
    route && selected !== null && profile.length >= 2
      ? positionAtFraction(
          route.coordinates,
          (selected - profile[0][0]) / Math.max(1, profile[profile.length - 1][0] - profile[0][0]),
        )
      : null;

  const publish = async () => {
    setMessage(undefined);
    setBusy('publish');
    try {
      const result = await withAdultConfirmation(
        () => ridesClient.publishRide(ride.id),
        () => void reloadMe(),
      );
      if (result) {
        setLoaded({ kind: 'loaded', ride: result.value });
        setMessage({ text: t('rides.detail.published'), tone: 'info' });
      }
    } catch (error) {
      setMessage({
        text:
          rideFailure(error) === 'validation'
            ? t('rides.errors.publishIncomplete')
            : rideErrorMessage(error),
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  };

  const remove = () => {
    Alert.alert(
      t('rides.detail.deleteTitle'),
      t('rides.detail.deleteMessage', { name: ride.name }),
      [
        { text: t('rides.detail.keep'), style: 'cancel' },
        {
          text: t('rides.detail.deleteConfirm'),
          style: 'destructive',
          onPress: async () => {
            setMessage(undefined);
            setBusy('delete');
            try {
              await ridesClient.deleteRide(ride.id);
              router.back();
            } catch (error) {
              setMessage({ text: rideErrorMessage(error), tone: 'error' });
              setBusy(null);
            }
          },
        },
      ],
    );
  };

  const places =
    ride.participantLimit === null
      ? null
      : ride.placesLeft === 0
        ? t('rides.detail.full', { limit: ride.participantLimit })
        : t('rides.detail.placesValue', {
            left: ride.placesLeft ?? ride.participantLimit - ride.confirmedCount,
            limit: ride.participantLimit,
          });

  const meetingText =
    meeting.kind === 'exact'
      ? t('rides.detail.meetingExact')
      : meeting.kind === 'area'
        ? t('rides.detail.meetingArea', { meters: roundMeters(meeting.radiusMeters) })
        : t('rides.detail.meetingNone');

  // TODO(#41 follow-up): "Hand over" (POST /api/rides/{id}/handover) needs the participant
  // list, which comes with the joining spec. The API call exists in api/rides.ts.

  return (
    <Screen>
      <View style={styles.badges}>
        {badge ? (
          <Badge
            text={t(`rides.badge.${badge}`)}
            tone={badge === 'cancelled' ? 'danger' : badge === 'draft' ? 'accent' : 'neutral'}
          />
        ) : null}
        {ride.ageRating ? (
          <Badge
            text={ageRatingText(ride.ageRating)}
            accessibilityLabel={ageRatingLabel(ride.ageRating)}
          />
        ) : null}
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        {ride.name}
      </Text>

      {ride.status === 'DRAFT' ? (
        <Text style={styles.note}>{t('rides.detail.draftNote')}</Text>
      ) : null}
      {ride.status === 'CANCELLED' ? (
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>{t('rides.detail.cancelled')}</Text>
          {ride.cancelMessage ? (
            <Text style={styles.note}>
              {t('rides.detail.cancelMessage', { message: ride.cancelMessage })}
            </Text>
          ) : null}
        </View>
      ) : null}
      {ride.past && ride.status !== 'CANCELLED' ? (
        <Text style={styles.note}>{t('rides.detail.pastNote')}</Text>
      ) : null}
      {ride.needsReconfirmation ? (
        <Text style={styles.note}>{t('rides.detail.needsReconfirmation')}</Text>
      ) : null}

      <View style={styles.facts}>
        <Fact label={t('rides.detail.when')} value={rideWhenText(ride)} />
        <Fact
          label={t('rides.form.discipline')}
          value={ride.discipline ? t(`profile.bicycleTypes.${ride.discipline}`) : null}
        />
        <Fact
          label={t('rides.form.pace')}
          value={ride.pace ? t(`rides.pace.${ride.pace}`) : null}
        />
        <Fact label={t('rides.detail.distance')} value={distanceText(distanceDisplay(ride))} />
        {!ride.distanceIsPlanned && ride.distanceMeters !== null ? (
          <Fact
            label={t('planner.stats.ascend')}
            value={
              ride.ascendMeters === null
                ? t('planner.stats.elevationUnavailable')
                : t('planner.stats.ascendValue', { meters: roundMeters(ride.ascendMeters) })
            }
          />
        ) : null}
        <Fact label={t('rides.detail.places')} value={places} />
        <Fact
          label={t('rides.form.accessMode')}
          value={ride.accessMode ? t(`rides.access.${ride.accessMode}`) : null}
        />
        {ride.admin?.displayName ? (
          <Fact label={t('rides.detail.admin')} value={ride.admin.displayName} />
        ) : null}
        {ride.ageRating ? (
          <Fact label={t('rides.detail.ageRating')} value={ageRatingLabel(ride.ageRating)} />
        ) : null}
      </View>

      {ride.description ? (
        <View style={styles.section}>
          <Text accessibilityRole="header" style={styles.subheading}>
            {t('rides.detail.description')}
          </Text>
          <Text style={styles.body}>{ride.description}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.subheading}>
          {t('rides.form.meetingPoint')}
        </Text>
        <Text style={styles.body}>{meetingText}</Text>
        {meeting.kind !== 'none' || route ? (
          <View style={styles.map}>
            <RideMap
              route={route}
              meeting={meeting}
              highlight={highlight}
              accessibilityLabel={
                meeting.kind === 'area'
                  ? t('rides.detail.mapLabelArea')
                  : t('rides.detail.mapLabelExact')
              }
              meetingPointLabel={t('rides.form.meetingPoint')}
            />
          </View>
        ) : null}
      </View>

      {profile.length >= 2 ? (
        <ElevationProfile profile={profile} selected={selected} onSelect={setSelected} />
      ) : null}
      <Surfaces surfaces={ride.surfaces} />

      <FormMessage message={message?.text} tone={message?.tone} />

      {actions.edit || actions.delete ? (
        <View style={styles.actions}>
          {actions.publish ? (
            <Button
              label={t('rides.form.publish')}
              accessibilityHint={t('rides.form.publishHint')}
              onPress={publish}
              busy={busy === 'publish'}
              disabled={busy !== null}
            />
          ) : null}
          {actions.edit ? (
            <Button
              variant="secondary"
              label={t('rides.detail.edit')}
              onPress={() => router.push({ pathname: '/ride-form', params: { id: ride.id } })}
              disabled={busy !== null}
            />
          ) : null}
          {actions.cancel ? (
            <Button
              variant="secondary"
              label={t('rides.detail.cancel')}
              onPress={() => router.push({ pathname: '/cancel-ride', params: { id: ride.id } })}
              disabled={busy !== null}
            />
          ) : null}
          {actions.delete ? (
            <Button
              variant="secondary"
              label={t('rides.detail.delete')}
              onPress={remove}
              busy={busy === 'delete'}
              disabled={busy !== null}
            />
          ) : null}
        </View>
      ) : null}
    </Screen>
  );
}

/** One labelled fact; read as "label: value". Hidden while the value is unknown. */
function Fact({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation();
  if (!value) return null;
  return (
    <View
      style={styles.fact}
      accessible
      accessibilityLabel={t('rides.detail.fact', { label, value })}
    >
      <Text style={styles.factLabel}>{label}</Text>
      <Text style={styles.factValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 20,
    backgroundColor: colors.background,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  subheading: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '600',
  },
  note: {
    color: colors.textMuted,
    fontSize: 15,
  },
  notice: {
    gap: 4,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  noticeTitle: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: '700',
  },
  facts: {
    gap: 10,
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  fact: {
    gap: 2,
  },
  factLabel: {
    color: colors.textMuted,
    fontSize: 13,
  },
  factValue: {
    color: colors.text,
    fontSize: 16,
  },
  section: {
    gap: 8,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 21,
  },
  map: {
    height: 260,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actions: {
    gap: 10,
  },
});
