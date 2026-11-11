import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { DISCIPLINES } from '@/api/routes';
import {
  ACCESS_MODES,
  PACES,
  PARTICIPANT_LIMIT_MAX,
  RIDE_DESCRIPTION_MAX_LENGTH,
  RIDE_NAME_MAX_LENGTH,
  rideFailure,
  validationFields,
  type Ride,
} from '@/api/rides';
import { ridesClient } from '@/api/ridesClient';
import { routesClient } from '@/api/routesClient';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { ChoiceGroup } from '@/components/rides/ChoiceGroup';
import { DateTimeField } from '@/components/rides/DateTimeField';
import { colors } from '@/constants/theme';
import { formatKilometres } from '@/planner/format';
import { withAdultConfirmation } from '@/rides/adultConfirmation';
import {
  dateFromPicker,
  deviceTimeZone,
  formatRideDate,
  pickerValue,
  timeFromPicker,
  timeZoneLabel,
  zonedToEpoch,
} from '@/rides/dateTime';
import { fieldErrorMessage, rideErrorMessage } from '@/rides/rideErrors';
import {
  emptyRideForm,
  explainServerErrors,
  hasErrors,
  mapServerFields,
  rideFormFromRide,
  rideFormFromRoute,
  startChanged,
  toRideBody,
  validateRideForm,
  type FieldErrors,
  type RideField,
  type RideForm,
  type ValidationMode,
} from '@/rides/rideForm';
import { rideFormStore } from '@/rides/rideFormStore';

type Loading = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; error: unknown };

/**
 * Create a ride (from a saved route or without one) or edit one. A draft can be saved at any
 * time with only a name; publishing checks every field. The backend repeats all checks.
 */
export default function RideFormScreen() {
  const { t, i18n } = useTranslation();
  const { id, routeId } = useLocalSearchParams<{ id?: string; routeId?: string }>();
  const { reloadMe } = useAuth();
  const state = useSyncExternalStore(rideFormStore.subscribe, rideFormStore.getState);
  const [loading, setLoading] = useState<Loading>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formMessage, setFormMessage] = useState<string>();
  const [busy, setBusy] = useState<ValidationMode | null>(null);
  // When the form opened: the picker's default day and the zone label before a start is set
  const [openedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const zone = deviceTimeZone();
      try {
        if (id) {
          const ride = await ridesClient.getRide(id);
          if (!cancelled) rideFormStore.start(rideFormFromRide(ride, zone), ride);
        } else if (routeId) {
          const route = await routesClient.getRoute(routeId);
          if (!cancelled) rideFormStore.start(rideFormFromRoute(route, zone), null);
        } else {
          rideFormStore.start(emptyRideForm(zone), null);
        }
        if (!cancelled) setLoading({ kind: 'ready' });
      } catch (error) {
        if (!cancelled) setLoading({ kind: 'failed', error });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, routeId, attempt]);

  // The form holds a meeting point: forget it when the form closes
  useEffect(() => () => rideFormStore.reset(), []);

  const title = id ? t('rides.form.editTitle') : t('rides.form.createTitle');

  if (loading.kind !== 'ready' || !state) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        {loading.kind === 'failed' ? (
          <>
            <FormMessage
              message={id ? t('rides.form.loadFailed') : t('rides.form.routeLoadFailed')}
            />
            <FormMessage message={rideErrorMessage(loading.error)} />
            <Button
              variant="secondary"
              label={t('rides.retry')}
              onPress={() => {
                setLoading({ kind: 'loading' });
                setAttempt((n) => n + 1);
              }}
            />
          </>
        ) : (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('common.loading')} />
        )}
      </Screen>
    );
  }

  const { form, ride } = state;
  const published = ride?.status === 'PUBLISHED';
  const startEpoch = zonedToEpoch(form.startDate, form.startTime, form.timeZone);

  const change = (field: RideField, update: (current: RideForm) => RideForm) => {
    rideFormStore.update(update);
    if (errors[field]) setErrors(({ [field]: _removed, ...rest }) => rest);
  };

  const context = (values: RideForm, saved: Ride | null) => ({
    now: Date.now(),
    confirmedCount: saved?.confirmedCount ?? 0,
    startChanged: saved ? startChanged(values, saved) : true,
  });

  const submit = async (mode: ValidationMode) => {
    const local = validateRideForm(form, mode, context(form, ride));
    setErrors(local);
    setFormMessage(undefined);
    if (hasErrors(local)) {
      setFormMessage(t('rides.form.checkFields'));
      return;
    }
    setBusy(mode);
    try {
      // Reads the store each time, so a retry after the 18+ confirmation updates the ride
      // created by the first attempt instead of creating a second one
      const result = await withAdultConfirmation(
        async () => {
          const current = rideFormStore.getState();
          if (!current) throw new Error('form closed');
          const body = toRideBody(current.form);
          let saved = current.ride
            ? await ridesClient.updateRide(current.ride.id, body)
            : await ridesClient.createRide(body);
          rideFormStore.saved(saved);
          if (mode === 'publish') saved = await ridesClient.publishRide(saved.id);
          return saved;
        },
        () => void reloadMe(),
      );
      if (!result) {
        setBusy(null);
        return;
      }
      if (id) router.back();
      else router.replace({ pathname: '/ride/[id]', params: { id: result.value.id } });
    } catch (error) {
      setBusy(null);
      const failure = rideFailure(error);
      if (failure === 'validation') {
        const server = mapServerFields(validationFields(error));
        const current = rideFormStore.getState();
        const explained = explainServerErrors(
          server.errors,
          current
            ? validateRideForm(current.form, 'publish', context(current.form, current.ride))
            : {},
        );
        setErrors(explained);
        setFormMessage(
          hasErrors(explained) && server.unknown.length === 0
            ? t('rides.form.checkFields')
            : t('rides.errors.validation'),
        );
      } else if (failure === 'limitBelowParticipants') {
        setErrors({ participantLimit: 'belowParticipants' });
        setFormMessage(rideErrorMessage(error));
      } else {
        setFormMessage(rideErrorMessage(error));
      }
    }
  };

  const error = (field: RideField) => fieldErrorMessage(field, errors[field]);
  const editable = busy === null;

  const routeText = form.route
    ? form.route.routeId && form.route.name
      ? t('rides.form.routeAttached', {
          name: form.route.name,
          km: formatKilometres(form.route.distanceMeters ?? 0),
        })
      : t('rides.form.routeCopy', { km: formatKilometres(form.route.distanceMeters ?? 0) })
    : t('rides.form.routeNone');

  return (
    <Screen intro={published ? undefined : t('rides.form.intro')}>
      <Stack.Screen options={{ title }} />

      <TextField
        label={t('rides.form.name')}
        hint={t('rides.form.nameHint')}
        error={error('name')}
        value={form.name}
        onChangeText={(name) => change('name', (f) => ({ ...f, name }))}
        maxLength={RIDE_NAME_MAX_LENGTH + 20}
        editable={editable}
      />
      <TextField
        label={t('rides.form.description')}
        hint={t('rides.form.descriptionHint')}
        error={error('description')}
        value={form.description}
        onChangeText={(description) => change('description', (f) => ({ ...f, description }))}
        maxLength={RIDE_DESCRIPTION_MAX_LENGTH + 100}
        multiline
        editable={editable}
      />

      <View style={styles.group}>
        <DateTimeField
          mode="date"
          label={t('rides.form.date')}
          displayValue={form.startDate ? formatRideDate(form.startDate, i18n.language) : null}
          pickerValue={pickerValue(form.startDate, form.startTime, new Date(openedAt))}
          onChange={(value) =>
            change('startDate', (f) => ({ ...f, startDate: dateFromPicker(value) }))
          }
          error={error('startDate')}
          disabled={!editable}
        />
        <DateTimeField
          mode="time"
          label={t('rides.form.time')}
          displayValue={form.startTime}
          pickerValue={pickerValue(form.startDate, form.startTime, new Date(openedAt))}
          onChange={(value) =>
            change('startTime', (f) => ({ ...f, startTime: timeFromPicker(value) }))
          }
          error={error('startTime')}
          disabled={!editable}
        />
        <Text style={styles.muted}>
          {t('rides.form.timeZone', {
            zone: timeZoneLabel(form.timeZone, startEpoch ?? openedAt, i18n.language),
          })}
        </Text>
        {published ? <Text style={styles.muted}>{t('rides.form.reconfirmNote')}</Text> : null}
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{t('rides.form.meetingPoint')}</Text>
        <Text style={styles.value}>
          {form.meetingPoint ? t('rides.form.meetingPointSet') : t('rides.form.meetingPointNone')}
        </Text>
        <Text style={styles.muted}>{t('rides.form.meetingPointPrivacy')}</Text>
        {error('meetingPoint') ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error('meetingPoint')}
          </Text>
        ) : null}
        <Button
          variant="secondary"
          label={
            form.meetingPoint
              ? t('rides.form.meetingPointChange')
              : t('rides.form.meetingPointChoose')
          }
          accessibilityHint={t('rides.form.meetingPointHint')}
          onPress={() => {
            setErrors(({ meetingPoint: _removed, ...rest }) => rest);
            router.push('/meeting-point');
          }}
          disabled={!editable}
        />
      </View>

      <ChoiceGroup
        label={t('rides.form.discipline')}
        choices={DISCIPLINES.map((value) => ({ value, label: t(`profile.bicycleTypes.${value}`) }))}
        value={form.discipline}
        onChange={(discipline) => change('discipline', (f) => ({ ...f, discipline }))}
        error={error('discipline')}
      />
      <ChoiceGroup
        label={t('rides.form.pace')}
        choices={PACES.map((value) => ({ value, label: t(`rides.pace.${value}`) }))}
        value={form.pace}
        onChange={(pace) => change('pace', (f) => ({ ...f, pace }))}
        error={error('pace')}
      />
      <TextField
        label={t('rides.form.participantLimit')}
        hint={t('rides.form.participantLimitHint')}
        error={error('participantLimit')}
        value={form.participantLimit}
        onChangeText={(participantLimit) =>
          change('participantLimit', (f) => ({ ...f, participantLimit }))
        }
        keyboardType="number-pad"
        maxLength={String(PARTICIPANT_LIMIT_MAX).length + 2}
        editable={editable}
      />
      <ChoiceGroup
        rows
        label={t('rides.form.accessMode')}
        choices={ACCESS_MODES.map((value) => ({
          value,
          label: t(`rides.access.${value}`),
          description: t(`rides.accessHelp.${value}`),
        }))}
        value={form.accessMode}
        onChange={(accessMode) => change('accessMode', (f) => ({ ...f, accessMode }))}
        error={error('accessMode')}
      />

      <View style={styles.group}>
        <Text style={styles.label}>{t('rides.form.route')}</Text>
        <Text style={styles.value}>{routeText}</Text>
        {error('route') ? (
          <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
            {error('route')}
          </Text>
        ) : null}
        <Button
          variant="secondary"
          label={form.route ? t('rides.form.changeRoute') : t('rides.form.attachRoute')}
          accessibilityHint={t('rides.form.attachHint')}
          onPress={() => {
            setErrors(({ route: _removed, ...rest }) => rest);
            router.push('/attach-route');
          }}
          disabled={!editable}
        />
      </View>
      {form.route ? null : (
        <TextField
          label={t('rides.form.targetDistance')}
          hint={t('rides.form.targetDistanceHint')}
          error={error('targetDistanceKm')}
          value={form.targetDistanceKm}
          onChangeText={(targetDistanceKm) =>
            change('targetDistanceKm', (f) => ({ ...f, targetDistanceKm }))
          }
          keyboardType="decimal-pad"
          maxLength={8}
          editable={editable}
        />
      )}
      <Text style={styles.muted}>{t('rides.form.ageNote')}</Text>

      <FormMessage message={formMessage} />

      <View style={styles.actions}>
        {published ? (
          <Button
            label={t('rides.form.save')}
            onPress={() => void submit('published')}
            busy={busy === 'published'}
            disabled={busy !== null}
          />
        ) : (
          <>
            <Button
              label={t('rides.form.publish')}
              accessibilityHint={t('rides.form.publishHint')}
              onPress={() => void submit('publish')}
              busy={busy === 'publish'}
              disabled={busy !== null}
            />
            <Button
              variant="secondary"
              label={t('rides.form.saveDraft')}
              accessibilityHint={t('rides.form.saveDraftHint')}
              onPress={() => void submit('draft')}
              busy={busy === 'draft'}
              disabled={busy !== null}
            />
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
    alignSelf: 'stretch',
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  value: {
    color: colors.text,
    fontSize: 16,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
  actions: {
    gap: 10,
  },
});
