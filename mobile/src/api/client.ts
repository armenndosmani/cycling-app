import { getApiBaseUrl } from "@/config/api";

const DEFAULT_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** GET a JSON resource from the backend. Throws ApiError on network errors, timeouts and non-2xx responses. */
export async function getJson<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new ApiError(`Request failed with status ${response.status}`, response.status);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    const message = controller.signal.aborted ? "Request timed out" : "Backend not reachable";
    throw new ApiError(message);
  } finally {
    clearTimeout(timer);
  }
}
