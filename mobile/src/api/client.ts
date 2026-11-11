import { getApiBaseUrl } from '@/config/api';

const DEFAULT_TIMEOUT_MS = 5000;

/** What went wrong, so screens can pick a translated message (see `errors.*` in en.json). */
export type ApiErrorKind = 'network' | 'timeout' | 'http';

export class ApiError extends Error {
  constructor(
    readonly kind: ApiErrorKind,
    readonly status?: number,
  ) {
    // The message is for developers only; never show it to users.
    super(status === undefined ? `API error: ${kind}` : `API error: ${kind} ${status}`);
    this.name = 'ApiError';
  }
}

/** GET a JSON resource from the backend. Throws ApiError on network errors, timeouts and non-2xx responses. */
export async function getJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError('http', response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}
