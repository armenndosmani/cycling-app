import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, MIN_TOUCH_TARGET } from '@/constants/theme';

export type Choice<T extends string> = {
  value: T;
  /** Translated label */
  label: string;
  /** Optional translated explanation shown under the label */
  description?: string;
};

type Props<T extends string> = {
  /** Group heading and screen-reader name. Pass a translated string. */
  label: string;
  choices: Choice<T>[];
  value: T | null;
  onChange: (value: T) => void;
  error?: string;
  /** Lay the choices out as full-width rows (for choices with a description) */
  rows?: boolean;
};

/** A single choice announced as a radio group; the selection shows a tick, not only colour. */
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  error,
  rows = false,
}: Props<T>) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <View
        style={rows ? styles.rows : styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        accessibilityHint={error}
      >
        {choices.map((choice) => {
          const selected = choice.value === value;
          return (
            <Pressable
              key={choice.value}
              accessibilityRole="radio"
              // The label and description texts inside are read together as its name
              accessibilityState={{ selected, checked: selected }}
              onPress={() => onChange(choice.value)}
              style={({ pressed }) => [
                rows ? styles.row : styles.chip,
                selected && styles.selected,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.text, selected && styles.selectedText]}>
                {selected ? '✓ ' : ''}
                {choice.label}
              </Text>
              {choice.description ? (
                <Text style={[styles.description, selected && styles.selectedText]}>
                  {choice.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
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
  heading: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  rows: {
    gap: 8,
  },
  chip: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: MIN_TOUCH_TARGET / 2,
    borderWidth: 1,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
  },
  row: {
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.textMuted,
    backgroundColor: colors.surface,
  },
  selected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  pressed: {
    opacity: 0.8,
  },
  text: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    color: colors.textMuted,
    fontSize: 13,
  },
  selectedText: {
    color: colors.onAccent,
  },
  error: {
    color: colors.danger,
    fontSize: 14,
  },
});
