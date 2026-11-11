import { errorMessage } from '@/api/errorMessage';
import { rideFailure } from '@/api/rides';
import i18n from '@/i18n';
import type { FieldError } from '@/rides/rideForm';

/** Plain-language message for a failed ride request. Never shows the backend's text. */
export function rideErrorMessage(error: unknown): string {
  switch (rideFailure(error)) {
    case 'limitBelowParticipants':
      return i18n.t('rides.errors.limitBelowParticipants');
    case 'ageRatingChangeBlocked':
      return i18n.t('rides.errors.ageRatingChangeBlocked');
    case 'adultConfirmationRequired':
      return i18n.t('rides.errors.adultConfirmationRequired');
    case 'validation':
      return i18n.t('rides.errors.validation');
    case 'notFound':
      return i18n.t('rides.errors.notFound');
    case 'forbidden':
      return i18n.t('rides.errors.forbidden');
    case 'conflict':
      return i18n.t('rides.errors.conflict');
    default:
      return errorMessage(error);
  }
}

/** Text next to a form field. */
export function fieldErrorMessage(
  field: string,
  error: FieldError | undefined,
): string | undefined {
  if (!error) return undefined;
  switch (error) {
    case 'required':
      if (field === 'name') return i18n.t('rides.fieldErrors.nameRequired');
      if (field === 'meetingPoint') return i18n.t('rides.fieldErrors.meetingPointRequired');
      return i18n.t('rides.fieldErrors.required');
    case 'tooShort':
      return i18n.t('rides.fieldErrors.nameLength');
    case 'tooLong':
      return field === 'description'
        ? i18n.t('rides.fieldErrors.descriptionTooLong')
        : i18n.t('rides.fieldErrors.nameLength');
    case 'invalid':
      return field === 'participantLimit'
        ? i18n.t('rides.fieldErrors.limitRange')
        : field === 'targetDistanceKm'
          ? i18n.t('rides.fieldErrors.distanceRange')
          : i18n.t('rides.fieldErrors.invalid');
    case 'outOfRange':
      return field === 'participantLimit'
        ? i18n.t('rides.fieldErrors.limitRange')
        : i18n.t('rides.fieldErrors.distanceRange');
    case 'tooSoon':
      return i18n.t('rides.fieldErrors.tooSoon');
    case 'inPast':
      return i18n.t('rides.fieldErrors.inPast');
    case 'belowParticipants':
      return i18n.t('rides.errors.limitBelowParticipants');
    case 'server':
      return i18n.t('rides.fieldErrors.server');
  }
}
