import { Stack } from 'expo-router';

import { stackScreenOptions } from '@/constants/theme';

export default function AppLayout() {
  return (
    <Stack screenOptions={stackScreenOptions}>
      {/* The home screen shows its own heading */}
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack>
  );
}
