import { DarkTheme, type Theme } from "expo-router";

// Dark, calm surfaces with a subtle green accent (see docs/product-context.md, section 7).
// The app always uses this theme, whatever the phone's light/dark setting.
export const colors = {
  background: "#111412",
  surface: "#1A1E1B",
  border: "#2A302C",
  text: "#EDEFEC",
  textMuted: "#9AA39C",
  accent: "#3FA66B",
  danger: "#D9665B",
};

export const navigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accent,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.accent,
  },
};
