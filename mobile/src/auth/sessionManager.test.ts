import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/api/ApiError';
import type { TokenResponse } from '@/api/auth';
import type { RequestOptions } from '@/api/client';
import { SessionManager } from '@/auth/sessionManager';
import type { StoredTokens, TokenStorage } from '@/auth/tokenStorage';

// Fake tokens only
const OLD = { accessToken: 'access-1', refreshToken: 'refresh-1' };
const NEW: TokenResponse = {
  accessToken: 'access-2',
  refreshToken: 'refresh-2',
  accessTokenExpiresIn: 900,
};

function memoryStorage(initial: StoredTokens | null) {
  let stored = initial;
  return {
    load: vi.fn(async () => stored),
    save: vi.fn(async (tokens: StoredTokens) => {
      stored = tokens;
    }),
    clear: vi.fn(async () => {
      stored = null;
    }),
    get current() {
      return stored;
    },
  } satisfies TokenStorage & { current: StoredTokens | null };
}

function bearer(options?: RequestOptions) {
  return options?.headers?.Authorization;
}

/** Fake backend: accepts only the given access token, 401 otherwise. */
function backendAccepting(validToken: () => string) {
  return vi.fn(async (_path: string, options?: RequestOptions) => {
    if (bearer(options) !== `Bearer ${validToken()}`) throw new ApiError('http', 401);
    return { ok: true } as never;
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let storage: ReturnType<typeof memoryStorage>;

beforeEach(() => {
  storage = memoryStorage(OLD);
});

describe('SessionManager', () => {
  it('loads tokens from storage and attaches the bearer token', async () => {
    const send = backendAccepting(() => OLD.accessToken);
    const session = new SessionManager({ storage, send, refresh: vi.fn() });

    expect(await session.init()).toBe(true);
    await session.authorized('/api/me');

    expect(bearer(send.mock.calls[0][1])).toBe('Bearer access-1');
  });

  it('shares one refresh between concurrent requests and retries each once', async () => {
    let valid = 'expired';
    const send = backendAccepting(() => valid);
    const pending = deferred<TokenResponse>();
    const refresh = vi.fn(() => pending.promise);
    const session = new SessionManager({ storage, send, refresh });

    const requests = [
      session.authorized('/api/me'),
      session.authorized('/api/me'),
      session.authorized('/api/me'),
    ];
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    valid = NEW.accessToken;
    pending.resolve(NEW);
    await Promise.all(requests);

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith('refresh-1');
    expect(send).toHaveBeenCalledTimes(6);
    expect(storage.current).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
  });

  it('does not refresh again for a 401 that arrives after another refresh finished', async () => {
    let valid = 'expired';
    const late = deferred<never>();
    let calls = 0;
    const send = vi.fn(async (_path: string, options?: RequestOptions) => {
      calls += 1;
      // The first request answers late, after the second one already refreshed
      if (calls === 1) {
        await late.promise.catch(() => undefined);
        throw new ApiError('http', 401);
      }
      if (bearer(options) !== `Bearer ${valid}`) throw new ApiError('http', 401);
      return undefined as never;
    });
    const refresh = vi.fn(async () => {
      valid = NEW.accessToken;
      return NEW;
    });
    const session = new SessionManager({ storage, send, refresh });

    const slow = session.authorized('/api/slow');
    await session.authorized('/api/fast');
    late.reject(new Error('done'));
    await slow;

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(bearer(send.mock.calls.at(-1)?.[1])).toBe('Bearer access-2');
  });

  it('signs out when the backend rejects the refresh', async () => {
    const send = backendAccepting(() => 'never-valid');
    const refresh = vi.fn(async () => {
      throw new ApiError('http', 401);
    });
    const session = new SessionManager({ storage, send, refresh });
    const listener = vi.fn();
    session.subscribe(listener);

    await expect(session.authorized('/api/me')).rejects.toMatchObject({ status: 401 });

    expect(session.isSignedIn).toBe(false);
    expect(storage.clear).toHaveBeenCalled();
    expect(storage.current).toBeNull();
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('keeps the session when the refresh fails for network reasons', async () => {
    const send = backendAccepting(() => 'never-valid');
    const refresh = vi.fn(async () => {
      throw new ApiError('network');
    });
    const session = new SessionManager({ storage, send, refresh });

    await expect(session.authorized('/api/me')).rejects.toMatchObject({ kind: 'network' });

    expect(session.isSignedIn).toBe(true);
    expect(storage.current).toEqual(OLD);
  });

  it('does not retry more than once', async () => {
    const send = backendAccepting(() => 'never-valid');
    const refresh = vi.fn(async () => NEW);
    const session = new SessionManager({ storage, send, refresh });

    await expect(session.authorized('/api/me')).rejects.toMatchObject({ status: 401 });

    expect(refresh).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('passes other errors through without refreshing', async () => {
    const send = vi.fn(async () => {
      throw new ApiError('http', 500);
    });
    const refresh = vi.fn();
    const session = new SessionManager({ storage, send, refresh });

    await expect(session.authorized('/api/me')).rejects.toMatchObject({ status: 500 });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('signs in, stores the tokens and notifies listeners', async () => {
    storage = memoryStorage(null);
    const session = new SessionManager({ storage, send: vi.fn(), refresh: vi.fn() });
    const listener = vi.fn();
    session.subscribe(listener);

    expect(await session.init()).toBe(false);
    await session.signIn(NEW);

    expect(session.isSignedIn).toBe(true);
    expect(storage.current).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-2' });
    expect(listener).toHaveBeenCalledWith(true);
  });

  it('revokes the session on sign-out and clears tokens even if the call fails', async () => {
    const send = vi.fn(async (_path: string, _options?: RequestOptions): Promise<never> => {
      throw new ApiError('network');
    });
    const session = new SessionManager({ storage, send, refresh: vi.fn() });
    const listener = vi.fn();
    session.subscribe(listener);

    await session.signOut();

    expect(send).toHaveBeenCalledWith(
      '/api/auth/sign-out',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(bearer(send.mock.calls[0][1])).toBe('Bearer access-1');
    expect(storage.current).toBeNull();
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('rejects authorised requests while signed out', async () => {
    storage = memoryStorage(null);
    const send = vi.fn();
    const session = new SessionManager({ storage, send, refresh: vi.fn() });

    await expect(session.authorized('/api/me')).rejects.toMatchObject({ status: 401 });
    expect(send).not.toHaveBeenCalled();
  });
});
