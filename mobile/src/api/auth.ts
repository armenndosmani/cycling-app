import { request } from '@/api/client';

/** Token pair returned by verify and refresh. Never log or persist these outside secure storage. */
export type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires */
  accessTokenExpiresIn: number;
  newAccount?: boolean;
};

export type VerifyCodeRequest = {
  email: string;
  code: string;
  /** Only sent when creating an account (after a registration-required answer) */
  confirmAge16?: boolean;
  acceptTermsVersion?: string;
};

/** Asks the backend to email a sign-in code. Answers 202 whether or not the account exists. */
export async function requestCode(email: string): Promise<void> {
  await request<void>('/api/auth/email/code', { method: 'POST', body: { email } });
}

/**
 * Exchanges an emailed code for tokens. Throws ApiError with Problem Details type
 * `registration-required` (403, carries `termsVersion`) when no account exists yet,
 * or `invalid-code` (400) when the code is wrong or expired.
 */
export function verifyCode(body: VerifyCodeRequest): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/email/verify', { method: 'POST', body });
}

/** Rotates the token pair. The refresh token is single-use. 401 means the session is gone. */
export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return request<TokenResponse>('/api/auth/refresh', { method: 'POST', body: { refreshToken } });
}
