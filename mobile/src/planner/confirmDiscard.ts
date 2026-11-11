import { Alert } from 'react-native';

import i18n from '@/i18n';
import { plannerStore } from '@/planner/plannerStore';

/** Runs `proceed` right away, or after the rider agrees to drop unsaved planner changes. */
export function confirmDiscard(proceed: () => void): void {
  if (!plannerStore.getState().dirty) {
    proceed();
    return;
  }
  Alert.alert(i18n.t('planner.discard.title'), i18n.t('planner.discard.message'), [
    { text: i18n.t('planner.discard.cancel'), style: 'cancel' },
    { text: i18n.t('planner.discard.confirm'), style: 'destructive', onPress: proceed },
  ]);
}
