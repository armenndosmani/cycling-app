import { ridesApi } from '@/api/rides';
import { session } from '@/auth/session';

/** Ride event endpoints, signed in with the app's session. */
export const ridesClient = ridesApi(session.authorized.bind(session));
