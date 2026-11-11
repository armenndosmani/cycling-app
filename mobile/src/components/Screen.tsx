import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

type Props = {
  /** Screen heading, announced as a header. Pass a translated string. */
  heading?: string;
  /** Short text under the heading. */
  intro?: string;
  children: ReactNode;
  /** Include the top inset when the screen has no navigation header. */
  withTopInset?: boolean;
};

/** Scrollable, keyboard-aware form screen; content grows with large text sizes. */
export function Screen({ heading, intro, children, withTopInset = false }: Props) {
  const edges: Edge[] = withTopInset
    ? ['top', 'bottom', 'left', 'right']
    : ['bottom', 'left', 'right'];

  return (
    <SafeAreaView style={styles.safeArea} edges={edges}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {heading ? (
            <Text accessibilityRole="header" style={styles.heading}>
              {heading}
            </Text>
          ) : null}
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: 16,
    padding: 20,
  },
  heading: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
  },
  intro: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 22,
  },
});
