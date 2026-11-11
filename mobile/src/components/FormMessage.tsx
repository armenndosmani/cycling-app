import { StyleSheet, Text } from 'react-native';

import { colors } from '@/constants/theme';

type Props = {
  /** Translated text; nothing is rendered when empty. */
  message?: string | null;
  tone?: 'error' | 'info';
};

/** Form-level message that screen readers announce when it appears. */
export function FormMessage({ message, tone = 'error' }: Props) {
  if (!message) return null;
  return (
    <Text
      accessibilityRole={tone === 'error' ? 'alert' : 'text'}
      accessibilityLiveRegion="polite"
      style={[styles.text, tone === 'error' ? styles.error : styles.info]}
    >
      {message}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 15,
    alignSelf: 'stretch',
  },
  error: {
    color: colors.danger,
  },
  info: {
    color: colors.text,
  },
});
