import { routesApi } from '@/api/routes';
import { session } from '@/auth/session';

/** Route planner endpoints, signed in with the app's session. */
export const routesClient = routesApi(session.authorized.bind(session));
