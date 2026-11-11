import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { stackScreenOptions } from '@/constants/theme';
import { plannerStore } from '@/planner/plannerStore';

export default function AppLayout() {
  const { t } = useTranslation();

  // The signed-in area unmounts on sign-out: forget the planner draft (it holds coordinates)
  useEffect(() => () => plannerStore.reset(), []);

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
    </Stack>
  );
}
