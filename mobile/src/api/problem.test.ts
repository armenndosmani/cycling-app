import { describe, expect, it } from 'vitest';

import { parseRetryAfter, toProblemDetails } from '@/api/problem';

describe('parseRetryAfter', () => {
  it('reads delay-seconds', () => {
    expect(parseRetryAfter('120')).toBe(120);
    expect(parseRetryAfter(' 5 ')).toBe(5);
  });

  it('never returns less than one second', () => {
    expect(parseRetryAfter('0')).toBe(1);
  });

  it('reads an HTTP date relative to now', () => {
    const now = Date.parse('2026-11-11T10:00:00Z');
    expect(parseRetryAfter('Wed, 11 Nov 2026 10:01:30 GMT', now)).toBe(90);
  });

  it('ignores missing or invalid values', () => {
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter('')).toBeUndefined();
    expect(parseRetryAfter('soon')).toBeUndefined();
    expect(parseRetryAfter('-5')).toBeUndefined();
  });
});

describe('toProblemDetails', () => {
  it('keeps extension members', () => {
    const problem = toProblemDetails({
      type: 'urn:cycling:problem:registration-required',
      status: 403,
      termsVersion: '2026-11',
    });
    expect(problem?.type).toBe('urn:cycling:problem:registration-required');
    expect(problem?.termsVersion).toBe('2026-11');
  });

  it('rejects bodies that are not Problem Details', () => {
    expect(toProblemDetails(undefined)).toBeUndefined();
    expect(toProblemDetails('error')).toBeUndefined();
    expect(toProblemDetails([1])).toBeUndefined();
    expect(toProblemDetails({ accessToken: 'x' })).toBeUndefined();
  });
});
