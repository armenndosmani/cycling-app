import { StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  /** Visible text, e.g. "18+" or "Draft". Pass a translated string. */
  text: string;
  /** Spoken instead of the text when it is an abbreviation */
  accessibilityLabel?: string;
  tone?: 'neutral' | 'accent' | 'danger';
};

/** Small outlined label; the word carries the meaning, the colour only supports it. */
export function Badge({ text, accessibilityLabel, tone = 'neutral' }: Props) {
  const color =
    tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.textMuted;
  return (
    <Text
      accessibilityLabel={accessibilityLabel}
      style={[styles.badge, { color, borderColor: color }]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: '700',
    overflow: 'hidden',
  },
});
