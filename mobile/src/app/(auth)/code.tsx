import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TextInputInstance } from 'react-native';

import { ApiError, isHttpStatus } from '@/api/ApiError';
import { requestCode, verifyCode } from '@/api/auth';
import { errorMessage } from '@/api/errorMessage';
import { PROBLEM_TYPES } from '@/api/problem';
import { useAuth } from '@/auth/AuthProvider';
import { sanitiseCode } from '@/auth/email';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { useCooldown } from '@/hooks/useCooldown';

const CODE_LENGTH = 6;
/** Wait before another code can be requested (the backend allows 3 per 15 minutes). */
const RESEND_COOLDOWN_SECONDS = 30;

export default function CodeScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const { email = '' } = useLocalSearchParams<{ email: string }>();
  const inputRef = useRef<TextInputInstance>(null);

  const [code, setCode] = useState('');
  const [fieldError, setFieldError] = useState<string>();
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'info' }>();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const cooldown = useCooldown(RESEND_COOLDOWN_SECONDS);

  const verify = async (value: string) => {
    if (verifying) return;
    setMessage(undefined);
    if (value.length !== CODE_LENGTH) {
      setFieldError(t('auth.code.invalidFormat'));
      return;
    }
    setFieldError(undefined);
    setVerifying(true);
    try {
      // On success the protected routes switch to the app or the display-name screen
      await signIn(await verifyCode({ email, code: value }));
    } catch (error) {
      if (error instanceof ApiError && error.hasProblemType(PROBLEM_TYPES.registrationRequired)) {
        const termsVersion = error.problem?.termsVersion;
        router.push({
          pathname: '/register',
          params: {
            email,
            code: value,
            termsVersion: typeof termsVersion === 'string' ? termsVersion : '',
          },
        });
        return;
      }
      if (error instanceof ApiError && error.hasProblemType(PROBLEM_TYPES.invalidCode)) {
        setCode('');
        setFieldError(t('auth.code.invalid'));
        inputRef.current?.focus();
        return;
      }
      setMessage({ text: errorMessage(error), tone: 'error' });
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    setMessage(undefined);
    setFieldError(undefined);
    setResending(true);
    try {
      await requestCode(email);
      setCode('');
      cooldown.start(RESEND_COOLDOWN_SECONDS);
      setMessage({ text: t('auth.code.resent'), tone: 'info' });
    } catch (error) {
      if (isHttpStatus(error, 429) && error.retryAfterSeconds !== undefined) {
        cooldown.start(error.retryAfterSeconds);
      }
      setMessage({ text: errorMessage(error), tone: 'error' });
    } finally {
      setResending(false);
    }
  };

  return (
    <Screen heading={t('auth.code.heading')} intro={t('auth.code.intro', { email })}>
      <TextField
        ref={inputRef}
        label={t('auth.code.label')}
        hint={t('auth.code.hint')}
        value={code}
        onChangeText={(value) => {
          const digits = sanitiseCode(value, CODE_LENGTH);
          setCode(digits);
          setFieldError(undefined);
          // Autofill and paste fill all digits at once: submit straight away
          if (digits.length === CODE_LENGTH) void verify(digits);
        }}
        error={fieldError}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={CODE_LENGTH}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => verify(code)}
        editable={!verifying}
      />
      <FormMessage message={message?.text} tone={message?.tone} />
      <Button label={t('auth.code.submit')} onPress={() => verify(code)} busy={verifying} />
      <Button
        variant="secondary"
        label={
          cooldown.remaining > 0
            ? t('auth.code.resendIn', { count: cooldown.remaining })
            : t('auth.code.resend')
        }
        onPress={resend}
        disabled={cooldown.remaining > 0 || verifying}
        busy={resending}
      />
      <Button variant="link" label={t('auth.code.changeEmail')} onPress={() => router.back()} />
    </Screen>
  );
}
