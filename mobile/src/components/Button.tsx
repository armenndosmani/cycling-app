import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';

type Props = {
  /** Visible text; also the screen-reader label unless `accessibilityLabel` is set. Pass a translated string. */
  label: string;
  onPress: () => void;
  /** Optional translated hint describing what happens on press. */
  accessibilityHint?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Shows a spinner and marks the button busy for screen readers. */
  busy?: boolean;
  variant?: 'primary' | 'secondary';
};

/** Accessible button: role "button", disabled/busy state, at least 44 pt tall, scales with the font size. */
export function Button({
  label,
  onPress,
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  busy = false,
  variant = 'primary',
}: Props) {
  const inactive = disabled || busy;
  const primary = variant === 'primary';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      hitSlop={8}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.secondary,
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={primary ? colors.onAccent : colors.text} />
      ) : (
        <Text style={[styles.text, primary ? styles.primaryText : styles.secondaryText]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TOUCH_TARGET,
    minWidth: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  pressed: {
    opacity: 0.8,
  },
  inactive: {
    opacity: 0.5,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryText: {
    color: colors.onAccent,
  },
  secondaryText: {
    color: colors.text,
  },
});
