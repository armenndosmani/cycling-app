/** RFC 9457 Problem Details, as returned by the backend for every error. */
export type ProblemDetails = {
  type?: string;
  title?: string;
  status?: number;
  detail?: string;
  instance?: string;
  /** Extension members, e.g. `termsVersion` */
  [extension: string]: unknown;
};

/** Problem types the app reacts to. Anything else is handled by HTTP status. */
export const PROBLEM_TYPES = {
  registrationRequired: 'urn:cycling:problem:registration-required',
  invalidCode: 'urn:cycling:problem:invalid-code',
} as const;

/** Returns the body as Problem Details if it looks like one, otherwise undefined. */
export function toProblemDetails(body: unknown): ProblemDetails | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return undefined;
  }
  const candidate = body as Record<string, unknown>;
  const looksLikeProblem =
    typeof candidate.type === 'string' ||
    typeof candidate.title === 'string' ||
    typeof candidate.status === 'number';
  return looksLikeProblem ? (candidate as ProblemDetails) : undefined;
}

/**
 * Parses a `Retry-After` header (RFC 9110): either delay-seconds or an HTTP date.
 * Returns whole seconds from `now`, at least 1, or undefined when missing or invalid.
 */
export function parseRetryAfter(
  value: string | null | undefined,
  now = Date.now(),
): number | undefined {
  if (!value) return undefined;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) {
    return Math.max(1, Number.parseInt(trimmed, 10));
  }
  // An HTTP date always contains a weekday or month name; this rejects things like "-5"
  if (!/[a-z]/i.test(trimmed)) return undefined;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return undefined;
  return Math.max(1, Math.ceil((date - now) / 1000));
}
