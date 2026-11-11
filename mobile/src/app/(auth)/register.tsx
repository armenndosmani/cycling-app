import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/ApiError';
import { verifyCode } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { PROBLEM_TYPES } from '@/api/problem';
import { useAuth } from '@/auth/AuthProvider';
import { Button } from '@/components/Button';
import { Checkbox } from '@/components/Checkbox';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';

/**
 * Shown when the code was correct but no account exists yet. The rider confirms 16+ and
 * accepts the terms, then the same code is sent again with both confirmations.
 */
export default function RegisterScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const {
    email = '',
    code = '',
    termsVersion = '',
  } = useLocalSearchParams<{ email: string; code: string; termsVersion: string }>();

  // Both start unticked: consent must be an active choice
  const [age16, setAge16] = useState(false);
  const [terms, setTerms] = useState(false);
  const [error, setError] = useState<string>();
  const [codeRejected, setCodeRejected] = useState(false);
  const [busy, setBusy] = useState(false);

  // TODO(launch): open the published terms of use and privacy notice (docs/launch-checklist.md)
  const showDocumentUnavailable = () =>
    Alert.alert(
      t('auth.register.documentUnavailableTitle'),
      t('auth.register.documentUnavailable'),
    );

  const submit = async () => {
    if (!age16 || !terms) {
      setError(t('auth.register.missing'));
      return;
    }
    if (!termsVersion) {
      setError(t('auth.register.missingTermsVersion'));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const tokens = await verifyCode({
        email,
        code,
        confirmAge16: true,
        acceptTermsVersion: termsVersion,
      });
      await signIn(tokens);
    } catch (caught) {
      setCodeRejected(
        caught instanceof ApiError && caught.hasProblemType(PROBLEM_TYPES.invalidCode),
      );
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen heading={t('auth.register.heading')} intro={t('auth.register.intro', { email })}>
      <Checkbox label={t('auth.register.age16')} checked={age16} onChange={setAge16} />
      <Checkbox label={t('auth.register.terms')} checked={terms} onChange={setTerms} />
      <View style={styles.links}>
        <Button
          variant="link"
          label={t('auth.register.termsLink')}
          onPress={showDocumentUnavailable}
        />
        <Button
          variant="link"
          label={t('auth.register.privacyLink')}
          onPress={showDocumentUnavailable}
        />
      </View>
      <FormMessage message={error} />
      <Button label={t('auth.register.submit')} onPress={submit} busy={busy} />
      {codeRejected || !termsVersion ? (
        <Button variant="secondary" label={t('common.back')} onPress={() => router.back()} />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
});
