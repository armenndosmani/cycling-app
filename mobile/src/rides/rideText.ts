import type { AgeRating, RideSummary } from '@/api/rides';
import i18n from '@/i18n';
import { formatKilometres } from '@/planner/format';
import { formatRideDate, timeZoneLabel, zonedToEpoch } from '@/rides/dateTime';
import type { AdminDisplay, DistanceDisplay, PlacesDisplay } from '@/rides/display';

type When = Pick<RideSummary, 'startDate' | 'startTime' | 'timeZone' | 'startsAt'>;

/** "Sat, 14 Nov 2026, 09:30 · Europe/Luxembourg (GMT+1)": the meeting point's local time. */
export function rideWhenText(ride: When): string {
  if (!ride.startDate) return i18n.t('rides.noDate');
  const date = formatRideDate(ride.startDate, i18n.language);
  if (!ride.startTime) return date;
  const at =
    zonedToEpoch(ride.startDate, ride.startTime, ride.timeZone) ??
    (ride.startsAt ? Date.parse(ride.startsAt) : Date.now());
  return ride.timeZone
    ? i18n.t('rides.whenWithZone', {
        date,
        time: ride.startTime,
        zone: timeZoneLabel(ride.timeZone, at, i18n.language),
      })
    : i18n.t('rides.when', { date, time: ride.startTime });
}

/** Distance text; a planned distance always reads "about … (planned)". */
export function distanceText(display: DistanceDisplay): string {
  if (display.kind === 'calculated') {
    return i18n.t('rides.distance.calculated', { km: formatKilometres(display.meters) });
  }
  if (display.kind === 'planned') return i18n.t('rides.distance.planned', { km: display.km });
  return i18n.t('rides.distance.none');
}

export function ageRatingText(rating: AgeRating): string {
  return rating === '16+' ? i18n.t('rides.ageRating.sixteen') : i18n.t('rides.ageRating.eighteen');
}

export function ageRatingLabel(rating: AgeRating): string {
  return rating === '16+'
    ? i18n.t('rides.ageRating.sixteenLabel')
    : i18n.t('rides.ageRating.eighteenLabel');
}

/** Places in a list row: how many are taken, the admin included. */
export function placesShortText(display: PlacesDisplay): string {
  switch (display.kind) {
    case 'noLimit':
      return i18n.t('rides.places.noLimit', { count: display.taken });
    case 'full':
      return i18n.t('rides.places.full', { limit: display.limit });
    case 'left':
      return i18n.t('rides.places.taken', { taken: display.taken, limit: display.limit });
  }
}

/** Places on the ride details: taken (admin included) and left. */
export function placesText(display: PlacesDisplay): string {
  switch (display.kind) {
    case 'noLimit':
      return i18n.t('rides.places.noLimit', { count: display.taken });
    case 'full':
      return i18n.t('rides.places.full', { limit: display.limit });
    case 'left':
      return i18n.t('rides.places.takenAndLeft', {
        taken: display.taken,
        limit: display.limit,
        left: display.left,
      });
  }
}

export function adminText(display: AdminDisplay): string {
  switch (display.kind) {
    case 'name':
      return display.name;
    case 'deleted':
      return i18n.t('rides.detail.adminDeleted');
    case 'unnamed':
      return i18n.t('rides.detail.adminUnnamed');
  }
}
