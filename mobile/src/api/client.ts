import { ApiError } from '@/api/ApiError';
import { parseRetryAfter, toProblemDetails } from '@/api/problem';
import { getApiBaseUrl } from '@/config/api';

export { ApiError, isHttpStatus, type ApiErrorKind } from '@/api/ApiError';

const DEFAULT_TIMEOUT_MS = 10_000;

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export type RequestOptions = {
  method?: HttpMethod;
  /** Sent as JSON */
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  /** Cancels the request; it then fails with an ApiError of kind `aborted`. */
  signal?: AbortSignal;
};

/**
 * Sends a request to the backend and returns the parsed JSON body (undefined for empty
 * responses such as 204). Throws ApiError on network errors, timeouts and non-2xx responses;
 * error responses carry their Problem Details and Retry-After.
 *
 * This function knows nothing about sign-in; use `session.authorized()` for endpoints that
 * need an access token.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, timeoutMs = DEFAULT_TIMEOUT_MS, signal } = options;
  if (signal?.aborted) throw new ApiError('aborted');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);
  const failureKind = () =>
    signal?.aborted ? 'aborted' : controller.signal.aborted ? 'timeout' : 'network';

  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers: {
        Accept: 'application/json, application/problem+json',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
    throw new ApiError(failureKind());
  }

  try {
    const text = await response.text();
    const parsed = parseJson(text);
    if (!response.ok) {
      throw new ApiError(
        'http',
        response.status,
        toProblemDetails(parsed),
        parseRetryAfter(response.headers.get('Retry-After')),
      );
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(failureKind());
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}

/** GET a JSON resource from the backend. */
export function getJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return request<T>(path, { timeoutMs });
}

function parseJson(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
