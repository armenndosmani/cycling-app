import { DarkTheme, type Theme } from 'expo-router';

// Dark, calm surfaces with a subtle green accent (see docs/product-context.md, section 7).
// The app always uses this theme, whatever the phone's light/dark setting.
// Contrast (WCAG 2.2 AA needs 4.5:1 for text): text, textMuted, accent and danger all reach
// at least 5:1 on background and surface; onAccent on accent is about 6:1. See docs/accessibility.md.
export const colors = {
  background: '#111412',
  surface: '#1A1E1B',
  border: '#2A302C',
  text: '#EDEFEC',
  textMuted: '#9AA39C',
  accent: '#3FA66B',
  danger: '#D9665B',
  /** Text and icons drawn on top of `accent` (e.g. primary button labels). */
  onAccent: '#111412',
};

/** Minimum size of anything tappable, in points (WCAG 2.5.8 / Apple HIG 44 pt). */
export const MIN_TOUCH_TARGET = 44;

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
