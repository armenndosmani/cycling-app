import { ApiError } from '@/api/ApiError';
import { PROBLEM_TYPES } from '@/api/problem';
import i18n from '@/i18n';

/**
 * Turns any error from the API layer into a translated message for the rider.
 * Backend titles and details are never shown; the type and status decide the text.
 */
export function errorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return i18n.t('errors.unexpected');
  if (error.kind === 'network') return i18n.t('errors.network');
  if (error.kind === 'timeout') return i18n.t('errors.timeout');
  if (error.hasProblemType(PROBLEM_TYPES.invalidCode)) return i18n.t('auth.code.invalid');

  const status = error.status ?? 0;
  if (status === 429) return retryAfterMessage(error.retryAfterSeconds);
  if (status === 401) return i18n.t('errors.sessionExpired');
  if (status === 400 || status === 422) return i18n.t('errors.invalidInput');
  if (status >= 500) return i18n.t('errors.server');
  return i18n.t('errors.unexpected');
}

/** "Too many attempts. Try again in …" from a Retry-After value in seconds. */
export function retryAfterMessage(seconds: number | undefined): string {
  if (seconds === undefined) return i18n.t('errors.rateLimitedLater');
  if (seconds < 60) return i18n.t('errors.rateLimitedSeconds', { count: seconds });
  return i18n.t('errors.rateLimitedMinutes', { count: Math.ceil(seconds / 60) });
}
