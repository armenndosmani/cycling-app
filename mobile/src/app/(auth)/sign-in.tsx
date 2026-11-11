import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { requestCode } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { isValidEmail, normaliseEmail } from '@/auth/email';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const normalised = normaliseEmail(email);
    setFormError(undefined);
    if (!isValidEmail(normalised)) {
      setFieldError(t('auth.email.invalid'));
      return;
    }
    setFieldError(undefined);
    setBusy(true);
    try {
      await requestCode(normalised);
      router.push({ pathname: '/code', params: { email: normalised } });
    } catch (error) {
      setFormError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen heading={t('auth.email.heading')} intro={t('auth.email.intro')}>
      <TextField
        label={t('auth.email.label')}
        placeholder={t('auth.email.placeholder')}
        value={email}
        onChangeText={(value) => {
          setEmail(value);
          setFieldError(undefined);
        }}
        error={fieldError}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        inputMode="email"
        returnKeyType="send"
        maxLength={254}
        onSubmitEditing={submit}
        editable={!busy}
      />
      <FormMessage message={formError} />
      <Button label={t('auth.email.submit')} onPress={submit} busy={busy} />
    </Screen>
  );
}
