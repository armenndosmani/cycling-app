import type { CameraRef } from '@maplibre/maplibre-react-native';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { LatLon, Place } from '@/api/routes';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { PlaceSearch } from '@/components/planner/PlaceSearch';
import { MEETING_POINT_ZOOM, RideMap } from '@/components/rides/RideMap';
import { colors } from '@/constants/theme';
import { rideFormStore } from '@/rides/rideFormStore';

/** Sets the ride's meeting point by tapping the map or searching a place. */
export default function MeetingPointScreen() {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraRef>(null);
  const [point, setPoint] = useState<LatLon | null>(
    () => rideFormStore.getState()?.form.meetingPoint ?? null,
  );

  const selectPlace = (place: Place) => {
    setPoint({ lat: place.lat, lon: place.lon });
    cameraRef.current?.easeTo({
      center: [place.lon, place.lat],
      zoom: MEETING_POINT_ZOOM,
      duration: 600,
    });
  };

  const use = () => {
    if (!point) return;
    rideFormStore.update((form) => ({ ...form, meetingPoint: point }));
    router.back();
  };

  // The form closed underneath (e.g. after sign-out): nothing to edit
  if (!rideFormStore.getState()) {
    return (
      <View style={styles.centered}>
        <FormMessage message={t('rides.form.loadFailed')} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.mapArea}>
          <RideMap
            route={null}
            meeting={point ? { kind: 'exact', point } : { kind: 'none' }}
            accessibilityLabel={t('rides.meetingPoint.mapLabel')}
            meetingPointLabel={t('rides.form.meetingPoint')}
            onPress={setPoint}
            cameraRef={cameraRef}
          />
        </View>
        <ScrollView
          style={styles.panel}
          contentContainerStyle={styles.panelContent}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.hint} accessibilityLiveRegion="polite">
            {point ? t('rides.meetingPoint.selected') : t('rides.meetingPoint.hint')}
          </Text>
          <PlaceSearch
            near={point}
            onSelect={selectPlace}
            resultHint={t('rides.meetingPoint.resultHint')}
          />
          <Button label={t('rides.meetingPoint.use')} onPress={use} disabled={!point} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: colors.background,
  },
  mapArea: {
    flex: 3,
  },
  panel: {
    flex: 2,
    backgroundColor: colors.surface,
  },
  panelContent: {
    gap: 14,
    padding: 16,
  },
  hint: {
    color: colors.text,
    fontSize: 15,
  },
});
