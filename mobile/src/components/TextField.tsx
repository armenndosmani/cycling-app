import { useState, type Ref } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
  type TextInputProps,
} from 'react-native';

import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';

type Props = Omit<TextInputProps, 'style' | 'accessibilityLabel'> & {
  /** Visible label and screen-reader name of the input. Pass a translated string. */
  label: string;
  /** Short help shown under the input and read as the accessibility hint. */
  hint?: string;
  /** Error text shown under the input; also announced. */
  error?: string;
  ref?: Ref<TextInputInstance>;
};

/** Labelled text input with hint and error text. A placeholder never replaces the label. */
export function TextField({ label, hint, error, ref, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.textMuted;

  return (
    <View style={styles.container}>
      {/* The input carries the label itself, so the visible label is not read twice */}
      <Text style={styles.label} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, { borderColor }]}
        {...inputProps}
      />
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 6,
    alignSelf: 'stretch',
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  input: {
    minHeight: MIN_TOUCH_TARGET + 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 17,
  },
  hint: {
    color: colors.textMuted,
    fontSize: 13,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
