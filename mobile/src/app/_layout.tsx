import '@/i18n';

import { SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthProvider, useAuth } from '@/auth/AuthProvider';
import { navigationTheme, stackScreenOptions } from '@/constants/theme';

// Keep the splash screen until we know whether a session exists
void SplashScreen.preventAutoHideAsync();

// The root view background comes from `backgroundColor` in app.json (needs expo-system-ui)
export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </ThemeProvider>
  );
}

/**
 * Signed out: the (auth) group (email, code, registration).
 * Signed in without a display name: the display-name screen.
 * Signed in with a profile: the (app) group.
 * Protected routes redirect automatically when the state changes.
 */
function RootNavigator() {
  const { status, me } = useAuth();
  const signedIn = status === 'signedIn';
  const needsProfile = signedIn && me !== null && me.displayName === null;

  if (status !== 'loading') {
    SplashScreen.hide();
  }

  return (
    <Stack screenOptions={{ ...stackScreenOptions, headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={needsProfile}>
        <Stack.Screen name="display-name" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !needsProfile}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}
