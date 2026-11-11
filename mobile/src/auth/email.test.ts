import { describe, expect, it, vi } from 'vitest';

import { isValidDisplayName } from '@/api/me';
import { isValidEmail, normaliseEmail, sanitiseCode } from '@/auth/email';

// api/me imports the app session, which needs the native secure store
vi.mock('@/auth/session', () => ({ session: {} }));

describe('email helpers', () => {
  it('normalises like the backend', () => {
    expect(normaliseEmail('  Rider@Example.TEST ')).toBe('rider@example.test');
  });

  it('accepts plausible addresses only', () => {
    expect(isValidEmail('rider@example.test')).toBe(true);
    expect(isValidEmail('rider@example')).toBe(false);
    expect(isValidEmail('rider example@example.test')).toBe(false);
    expect(isValidEmail(`${'a'.repeat(250)}@x.de`)).toBe(false);
  });

  it('keeps only the code digits', () => {
    expect(sanitiseCode('123 456')).toBe('123456');
    expect(sanitiseCode('12-34-56-78')).toBe('123456');
    expect(sanitiseCode('abc')).toBe('');
  });
});

describe('isValidDisplayName', () => {
  it('needs 2 to 40 characters after trimming', () => {
    expect(isValidDisplayName(' A ')).toBe(false);
    expect(isValidDisplayName('Al')).toBe(true);
    expect(isValidDisplayName('x'.repeat(40))).toBe(true);
    expect(isValidDisplayName('x'.repeat(41))).toBe(false);
  });
});
