import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { RIDE_CANCEL_MESSAGE_MAX_LENGTH } from '@/api/rides';
import { ridesClient } from '@/api/ridesClient';
import { Button } from '@/components/Button';
import { FormMessage } from '@/components/FormMessage';
import { Screen } from '@/components/Screen';
import { TextField } from '@/components/TextField';
import { rideErrorMessage } from '@/rides/rideErrors';

/** Confirms cancelling a published ride, with an optional message to the riders. */
export default function CancelRideScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [message, setMessage] = useState('');
  const [tooLong, setTooLong] = useState(false);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const cancel = async () => {
    const long = [...message.trim()].length > RIDE_CANCEL_MESSAGE_MAX_LENGTH;
    setTooLong(long);
    setError(undefined);
    if (long) return;
    setBusy(true);
    try {
      await ridesClient.cancelRide(id, message);
      router.back();
    } catch (caught) {
      setError(rideErrorMessage(caught));
      setBusy(false);
    }
  };

  return (
    <Screen intro={t('rides.cancel.intro')}>
      <TextField
        label={t('rides.cancel.messageLabel')}
        hint={t('rides.cancel.messageHint')}
        error={tooLong ? t('rides.cancel.messageTooLong') : undefined}
        value={message}
        onChangeText={setMessage}
        maxLength={RIDE_CANCEL_MESSAGE_MAX_LENGTH + 50}
        multiline
        editable={!busy}
      />
      <FormMessage message={error} />
      <Button label={t('rides.cancel.confirm')} onPress={cancel} busy={busy} />
      <Button
        variant="secondary"
        label={t('rides.cancel.keep')}
        onPress={() => router.back()}
        disabled={busy}
      />
    </Screen>
  );
}
