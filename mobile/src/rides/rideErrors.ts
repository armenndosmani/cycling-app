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
    case 'notRideAdmin':
      return i18n.t('rides.errors.notRideAdmin');
    case 'notEditable':
      return i18n.t('rides.errors.notEditable');
    case 'notDraft':
      return i18n.t('rides.errors.notDraft');
    case 'notPublished':
      return i18n.t('rides.errors.notPublished');
    case 'handoverTargetInvalid':
      return i18n.t('rides.errors.handoverTargetInvalid');
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

/**
 * Saving a ride that attaches a saved route: a 404 may mean the route was deleted (the backend
 * sends the same plain 404 for a missing route as for a missing ride).
 */
export function rideSaveErrorMessage(error: unknown, routeAttached: boolean): string {
  if (routeAttached && rideFailure(error) === 'notFound') {
    return i18n.t('rides.errors.routeOrRideNotFound');
  }
  return rideErrorMessage(error);
}

/**
 * The ride changed on the server (cancelled, started, published, or handed over), so the
 * screen should reload it to show what is possible now.
 */
export function isStaleRideFailure(error: unknown): boolean {
  const failure = rideFailure(error);
  return (
    failure === 'notRideAdmin' ||
    failure === 'notEditable' ||
    failure === 'notDraft' ||
    failure === 'notPublished'
  );
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
    case 'belowParticipants':
      return i18n.t('rides.errors.limitBelowParticipants');
    case 'server':
      return i18n.t('rides.fieldErrors.server');
  }
}
