import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { requestCode, verifyCode } from '@/api/auth';
import { ApiError, request } from '@/api/client';
import { PROBLEM_TYPES } from '@/api/problem';

vi.mock('@/config/api', () => ({ getApiBaseUrl: () => 'http://api.test' }));

const fetchMock = vi.fn<typeof fetch>();

function problem(status: number, body: object, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ status, ...body }), {
    status,
    headers: { 'Content-Type': 'application/problem+json', ...headers },
  });
}

async function caught(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected the request to fail');
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('request', () => {
  it('sends JSON and accepts an empty 202', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 202 }));

    await expect(requestCode('rider@example.test')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://api.test/api/auth/email/code');
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe(JSON.stringify({ email: 'rider@example.test' }));
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('returns the parsed body', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          accessToken: 'a',
          refreshToken: 'r',
          accessTokenExpiresIn: 900,
          newAccount: false,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    const tokens = await verifyCode({ email: 'rider@example.test', code: '123456' });
    expect(tokens.accessToken).toBe('a');
  });

  it('parses 429 Problem Details with Retry-After', async () => {
    fetchMock.mockResolvedValue(
      problem(429, { title: 'Too Many Requests' }, { 'Retry-After': '600' }),
    );

    const error = await caught(requestCode('rider@example.test'));
    expect(error.kind).toBe('http');
    expect(error.status).toBe(429);
    expect(error.retryAfterSeconds).toBe(600);
  });

  it('exposes registration-required with termsVersion', async () => {
    fetchMock.mockResolvedValue(
      problem(403, { type: PROBLEM_TYPES.registrationRequired, termsVersion: '2026-11-11' }),
    );

    const error = await caught(verifyCode({ email: 'rider@example.test', code: '123456' }));
    expect(error.hasProblemType(PROBLEM_TYPES.registrationRequired)).toBe(true);
    expect(error.problem?.termsVersion).toBe('2026-11-11');
  });

  it('handles error responses without a body', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));

    const error = await caught(request('/api/me'));
    expect(error.status).toBe(500);
    expect(error.problem).toBeUndefined();
  });

  it('reports network failures', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    const error = await caught(request('/api/me'));
    expect(error.kind).toBe('network');
    expect(error.status).toBeUndefined();
  });
});
