import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { stackScreenOptions } from '@/constants/theme';
import { plannerStore } from '@/planner/plannerStore';
import { rideFormStore } from '@/rides/rideFormStore';

export default function AppLayout() {
  const { t } = useTranslation();

  // The signed-in area unmounts on sign-out: forget the planner draft and any ride form
  // (both hold coordinates)
  useEffect(
    () => () => {
      plannerStore.reset();
      rideFormStore.reset();
    },
    [],
  );

  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The home screen shows its own heading */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="planner" options={{ title: t('planner.title') }} />
      <Stack.Screen name="routes" options={{ title: t('routes.title') }} />
      <Stack.Screen
        name="save-route"
        options={{ title: t('routeDetails.saveTitle'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="rename-route"
        options={{ title: t('routeDetails.renameTitle'), presentation: 'modal' }}
      />
      <Stack.Screen name="rides" options={{ title: t('rides.title') }} />
      <Stack.Screen name="ride/[id]" options={{ title: t('rides.detail.title') }} />
      {/* The form sets its own title (create or edit) */}
      <Stack.Screen name="ride-form" options={{ title: t('rides.form.createTitle') }} />
      <Stack.Screen
        name="meeting-point"
        options={{ title: t('rides.meetingPoint.title'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="attach-route"
        options={{ title: t('rides.attachRoute.title'), presentation: 'modal' }}
      />
      <Stack.Screen
        name="cancel-ride"
        options={{ title: t('rides.cancel.title'), presentation: 'modal' }}
      />
    </Stack>
  );
}
