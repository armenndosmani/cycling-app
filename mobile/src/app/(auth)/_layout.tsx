import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { stackScreenOptions } from '@/constants/theme';

// Start at the email screen, also when the root redirects here after sign-out
export const unstable_settings = {
  initialRouteName: 'sign-in',
};

export default function AuthLayout() {
  const { t } = useTranslation();

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerBackButtonDisplayMode: 'minimal' }}>
      <Stack.Screen name="sign-in" options={{ title: t('auth.email.title') }} />
      <Stack.Screen name="code" options={{ title: t('auth.code.title') }} />
      <Stack.Screen name="register" options={{ title: t('auth.register.title') }} />
    </Stack>
  );
}
