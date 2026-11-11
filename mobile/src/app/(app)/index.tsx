import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { errorMessage } from '@/api/errorMessage';
import { getHealth, type HealthStatus } from '@/api/health';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { getApiBaseUrl } from '@/config/api';
import { colors } from '@/constants/theme';

type BackendState =
  | { kind: 'checking' }
  | { kind: 'reachable'; status: HealthStatus }
  | { kind: 'unreachable'; error: unknown };

/** Signed-in home for now: who is signed in, backend status and sign-out. */
export default function Index() {
  const { t } = useTranslation();
  const { me, reloadMe, signOut } = useAuth();
  const [backend, setBackend] = useState<BackendState>({ kind: 'checking' });
  const [attempt, setAttempt] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [reloading, setReloading] = useState(false);

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

  const reload = async () => {
    setReloading(true);
    await reloadMe();
    setReloading(false);
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    // The protected routes switch to the sign-in screen once the session is cleared
    await signOut();
  };

  const isUp = backend.kind === 'reachable' && backend.status === 'UP';
  const statusText =
    backend.kind === 'reachable'
      ? t(`status.result.${backend.status}`)
      : t('status.result.unreachable');

  return (
    <Screen withTopInset>
      <View style={styles.section}>
        {me?.displayName ? (
          <Text style={styles.signedInAs}>{t('home.signedInAs', { name: me.displayName })}</Text>
        ) : (
          <>
            <Text style={styles.muted}>{t('home.profileUnavailable')}</Text>
            <Button
              variant="secondary"
              label={t('home.reloadProfile')}
              onPress={reload}
              busy={reloading}
            />
          </>
        )}
      </View>

      <View style={styles.section}>
        <Button label={t('home.planRoute')} onPress={() => router.push('/planner')} />
        <Button
          variant="secondary"
          label={t('home.myRoutes')}
          onPress={() => router.push('/routes')}
        />
        <Button label={t('home.myRides')} onPress={() => router.push('/rides')} />
        <Button
          variant="secondary"
          label={t('home.createRide')}
          onPress={() => router.push('/ride-form')}
        />
      </View>

      <View style={styles.section}>
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

      <Button
        variant="secondary"
        label={t('home.signOut')}
        onPress={handleSignOut}
        busy={signingOut}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    alignItems: 'center',
    gap: 16,
  },
  signedInAs: {
    color: colors.text,
    fontSize: 17,
    textAlign: 'center',
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
