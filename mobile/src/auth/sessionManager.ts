import { ApiError, isHttpStatus } from '@/api/ApiError';
import type { TokenResponse } from '@/api/auth';
import type { RequestOptions } from '@/api/client';
import type { StoredTokens, TokenStorage } from '@/auth/tokenStorage';

type Send = <T>(path: string, options?: RequestOptions) => Promise<T>;

export type SessionDeps = {
  storage: TokenStorage;
  /** Unauthenticated request function (`request` from api/client) */
  send: Send;
  /** Calls POST /api/auth/refresh */
  refresh: (refreshToken: string) => Promise<TokenResponse>;
};

type Listener = (signedIn: boolean) => void;

/** Refresh answers that mean the session is gone for good (anything else may be temporary). */
const SESSION_GONE_STATUSES = [400, 401, 403];

/**
 * Holds the session tokens and sends authorised requests.
 *
 * - Adds `Authorization: Bearer <access token>`.
 * - On 401 it refreshes once and retries once. Concurrent requests share one in-flight refresh,
 *   because refresh tokens are single-use and reusing one revokes the whole session.
 * - If the backend rejects the refresh, the session is cleared and listeners hear "signed out".
 *   Network errors during a refresh keep the session, so a bad connection never signs anyone out.
 */
export class SessionManager {
  private tokens: StoredTokens | null = null;
  private loaded: Promise<void> | null = null;
  private refreshing: Promise<string> | null = null;
  /** Bumped on every sign-in and sign-out, so a late refresh result never revives an old session */
  private generation = 0;
  private listeners = new Set<Listener>();

  constructor(private readonly deps: SessionDeps) {}

  /** Loads tokens from secure storage once. Returns whether a session exists. */
  async init(): Promise<boolean> {
    this.loaded ??= this.deps.storage
      .load()
      // Unreadable secure storage (e.g. after a device restore) means: sign in again
      .catch(() => null)
      .then((tokens) => {
        // A sign-in that finished while loading wins
        this.tokens ??= tokens;
      });
    await this.loaded;
    return this.tokens !== null;
  }

  get isSignedIn(): boolean {
    return this.tokens !== null;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async signIn(response: TokenResponse): Promise<void> {
    this.generation += 1;
    this.refreshing = null;
    this.tokens = { accessToken: response.accessToken, refreshToken: response.refreshToken };
    await this.deps.storage.save(this.tokens);
    this.emit(true);
  }

  /** Revokes the session on the server (best effort) and always deletes the local tokens. */
  async signOut(): Promise<void> {
    await this.init();
    if (this.tokens) {
      try {
        await this.authorized<void>('/api/auth/sign-out', { method: 'POST' });
      } catch {
        // Offline or already revoked: the local sign-out below still happens
      }
    }
    await this.clear();
  }

  /** Sends a request with the access token, refreshing once on 401. */
  async authorized<T>(path: string, options: RequestOptions = {}): Promise<T> {
    await this.init();
    const token = this.tokens?.accessToken;
    if (!token) {
      throw new ApiError('http', 401);
    }
    try {
      return await this.deps.send<T>(path, withBearer(options, token));
    } catch (error) {
      if (!isHttpStatus(error, 401)) throw error;
      const fresh = await this.freshAccessToken(token);
      return this.deps.send<T>(path, withBearer(options, fresh));
    }
  }

  /** Returns an access token newer than `stale`, refreshing at most once for all callers. */
  private freshAccessToken(stale: string): Promise<string> {
    const current = this.tokens?.accessToken;
    if (current && current !== stale) {
      // Another request already refreshed while this one was in flight
      return Promise.resolve(current);
    }
    this.refreshing ??= this.refresh().finally(() => {
      this.refreshing = null;
    });
    return this.refreshing;
  }

  private async refresh(): Promise<string> {
    const refreshToken = this.tokens?.refreshToken;
    if (!refreshToken) {
      throw new ApiError('http', 401);
    }
    const generation = this.generation;
    let response: TokenResponse;
    try {
      response = await this.deps.refresh(refreshToken);
    } catch (error) {
      if (isHttpStatus(error, ...SESSION_GONE_STATUSES) && generation === this.generation) {
        await this.clear();
      }
      throw error;
    }
    if (generation !== this.generation) {
      // Signed out or in again meanwhile; drop this result
      throw new ApiError('http', 401);
    }
    this.tokens = { accessToken: response.accessToken, refreshToken: response.refreshToken };
    await this.deps.storage.save(this.tokens);
    return response.accessToken;
  }

  private async clear(): Promise<void> {
    const wasSignedIn = this.tokens !== null;
    this.generation += 1;
    this.tokens = null;
    this.refreshing = null;
    await this.deps.storage.clear();
    if (wasSignedIn) this.emit(false);
  }

  private emit(signedIn: boolean) {
    this.listeners.forEach((listener) => listener(signedIn));
  }
}

function withBearer(options: RequestOptions, token: string): RequestOptions {
  return { ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } };
}
