import { Stack, ThemeProvider } from "expo-router";
import { StatusBar } from "expo-status-bar";

import { colors, navigationTheme } from "@/constants/theme";

// The root view background comes from `backgroundColor` in app.json (needs expo-system-ui)
export default function RootLayout() {
  return (
    <ThemeProvider value={navigationTheme}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </ThemeProvider>
  );
}
