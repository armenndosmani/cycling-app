import Constants from "expo-constants";

const BACKEND_PORT = 8080;

/**
 * Base URL of the backend API.
 *
 * 1. `EXPO_PUBLIC_API_URL` wins when set (see `.env.example`).
 * 2. In development, use the host the Expo dev server runs on. That is the
 *    developer's machine, reachable from simulators and from phones on the
 *    same network.
 * 3. Otherwise fall back to localhost.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, "");
  }

  // e.g. "192.168.1.20:8081"; only present while running through the Expo CLI
  const devHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (devHost) {
    return `http://${devHost}:${BACKEND_PORT}`;
  }

  return `http://localhost:${BACKEND_PORT}`;
}
