import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/ApiError';
import { errorMessage, retryAfterMessage } from '@/api/errorMessage';
import { PROBLEM_TYPES } from '@/api/problem';

describe('errorMessage', () => {
  it('maps the invalid-code problem to the code message', () => {
    const error = new ApiError('http', 400, { type: PROBLEM_TYPES.invalidCode });
    expect(errorMessage(error)).toBe('That code is not valid or has expired.');
  });

  it('tells the rider when to try again after 429', () => {
    expect(errorMessage(new ApiError('http', 429, undefined, 1))).toBe(
      'Too many attempts. Try again in 1 second.',
    );
    expect(errorMessage(new ApiError('http', 429, undefined, 45))).toBe(
      'Too many attempts. Try again in 45 seconds.',
    );
    expect(errorMessage(new ApiError('http', 429, undefined, 600))).toBe(
      'Too many attempts. Try again in 10 minutes.',
    );
    expect(retryAfterMessage(61)).toBe('Too many attempts. Try again in 2 minutes.');
    expect(retryAfterMessage(undefined)).toBe('Too many attempts. Try again later.');
  });

  it('never shows backend text', () => {
    const error = new ApiError('http', 500, { title: 'NullPointerException', detail: 'secret' });
    expect(errorMessage(error)).toBe('Something went wrong on our side. Try again later.');
  });

  it('covers network, timeout and unknown errors', () => {
    expect(errorMessage(new ApiError('network'))).toMatch(/reach the server/);
    expect(errorMessage(new ApiError('timeout'))).toMatch(/too long/);
    expect(errorMessage(new Error('boom'))).toBe('Something went wrong. Try again.');
  });
});
