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
  /** `link` looks like a text link and is announced as a link. */
  variant?: 'primary' | 'secondary' | 'link';
};

/** Accessible button: role, disabled/busy state, at least 44 pt tall, scales with the font size. */
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

  return (
    <Pressable
      accessibilityRole={variant === 'link' ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        variantStyles[variant],
        pressed && styles.pressed,
        inactive && styles.inactive,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={variant === 'primary' ? colors.onAccent : colors.text} />
      ) : (
        <Text style={[styles.text, textStyles[variant]]}>{label}</Text>
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
});

const variantStyles = StyleSheet.create({
  primary: {
    backgroundColor: colors.accent,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.textMuted,
  },
  link: {
    backgroundColor: 'transparent',
    paddingHorizontal: 4,
  },
});

const textStyles = StyleSheet.create({
  primary: {
    color: colors.onAccent,
  },
  secondary: {
    color: colors.text,
  },
  link: {
    color: colors.accent,
    textDecorationLine: 'underline',
  },
});
