import { refreshTokens } from '@/api/auth';
import { request } from '@/api/client';
import { SessionManager } from '@/auth/sessionManager';
import { secureTokenStorage } from '@/auth/tokenStorage';

/** The app's single session. Use `session.authorized()` for every endpoint that needs sign-in. */
export const session = new SessionManager({
  storage: secureTokenStorage,
  send: request,
  refresh: refreshTokens,
});
