import type { ProblemDetails } from '@/api/problem';

/**
 * What went wrong, so screens can pick a translated message (see `errorMessage`).
 * `aborted` means the caller cancelled the request (e.g. a newer one replaced it).
 */
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'aborted';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
    /** Parsed Problem Details body of an error response, if there was one */
    readonly problem?: ProblemDetails,
    /** Seconds from the `Retry-After` header (429 and 503 responses) */
    readonly retryAfterSeconds?: number,
  ) {
    // The message is for developers only; never show it to users.
    super(status === undefined ? `API error: ${kind}` : `API error: ${kind} ${status}`);
    this.name = 'ApiError';
  }

  /** True for an HTTP error response with this Problem Details `type`. */
  hasProblemType(type: string): boolean {
    return this.problem?.type === type;
  }
}

/** True when `error` is an HTTP error response with one of these statuses. */
export function isHttpStatus(error: unknown, ...statuses: number[]): error is ApiError {
  return (
    error instanceof ApiError &&
    error.kind === 'http' &&
    error.status !== undefined &&
    statuses.includes(error.status)
  );
}
