import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { ApiError } from '@/api/client';
import { getHealth, type HealthStatus } from '@/api/health';
import { Button } from '@/components/Button';
import { getApiBaseUrl } from '@/config/api';
import { colors } from '@/constants/theme';

type BackendState =
  | { kind: 'checking' }
  | { kind: 'reachable'; status: HealthStatus }
  | { kind: 'unreachable'; error: unknown };

export default function Index() {
  const { t } = useTranslation();
  const [backend, setBackend] = useState<BackendState>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getHealth()
      .then((health) => {
        if (!cancelled) setBackend({ kind: 'reachable', status: health.status });
      })
      .catch((error: unknown) => {
        if (!cancelled) setBackend({ kind: 'unreachable', error });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const check = () => {
    setBackend({ kind: 'checking' });
    setAttempt((n) => n + 1);
  };

  const errorMessage = (error: unknown): string => {
    if (!(error instanceof ApiError)) return t('errors.unexpected');
    if (error.kind === 'http') return t('errors.http', { status: error.status });
    return t(`errors.${error.kind}`);
  };

  const isUp = backend.kind === 'reachable' && backend.status === 'UP';
  const statusText =
    backend.kind === 'reachable'
      ? t(`status.result.${backend.status}`)
      : t('status.result.unreachable');

  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title}>
        {t('status.title')}
      </Text>

      {/* Live region: screen readers announce the result when the check finishes */}
      <View style={styles.card} accessible accessibilityLiveRegion="polite">
        {backend.kind === 'checking' ? (
          <ActivityIndicator color={colors.accent} accessibilityLabel={t('status.checking')} />
        ) : (
          <>
            {/* The dot is decorative; the status text carries the meaning */}
            <View
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={[styles.dot, { backgroundColor: isUp ? colors.accent : colors.danger }]}
            />
            <Text style={styles.status}>{statusText}</Text>
            {backend.kind === 'unreachable' && (
              <Text style={styles.muted}>{errorMessage(backend.error)}</Text>
            )}
          </>
        )}
      </View>

      <Text style={styles.muted}>{t('status.serverAddress', { url: getApiBaseUrl() })}</Text>

      <Button
        label={t('status.checkAgain')}
        accessibilityHint={t('status.checkAgainHint')}
        onPress={check}
        disabled={backend.kind === 'checking'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '600',
  },
  card: {
    alignItems: 'center',
    gap: 8,
    minWidth: 220,
    padding: 20,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  status: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '600',
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
});
