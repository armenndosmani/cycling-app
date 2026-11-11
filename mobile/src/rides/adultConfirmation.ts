import { Alert } from 'react-native';

import { confirmAdult } from '@/api/me';
import { rideFailure } from '@/api/rides';
import i18n from '@/i18n';

/** Asks once for the "I am 18 or older" self-declaration. Resolves true when given. */
function askAdultConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      i18n.t('rides.adult.title'),
      i18n.t('rides.adult.message'),
      [
        { text: i18n.t('rides.adult.decline'), style: 'cancel', onPress: () => resolve(false) },
        { text: i18n.t('rides.adult.confirm'), onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

/**
 * Runs a ride action. When the backend answers that an 18+ ride needs the rider's 18+
 * confirmation, asks for it, stores it (`POST /api/me/adult-confirmation`) and retries once.
 * Returns null when the rider declines; other errors are thrown.
 */
export async function withAdultConfirmation<T>(
  action: () => Promise<T>,
  onConfirmed?: () => void,
): Promise<{ value: T } | null> {
  try {
    return { value: await action() };
  } catch (error) {
    if (rideFailure(error) !== 'adultConfirmationRequired') throw error;
    if (!(await askAdultConfirmation())) return null;
    await confirmAdult();
    onConfirmed?.();
    return { value: await action() };
  }
}
