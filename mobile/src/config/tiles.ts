import { getDevHost } from '@/config/devHost';

const TILE_SERVER_PORT = 3000;

/**
 * Base URL of our own tile server (Martin). Tiles, fonts and sprites all come from here;
 * the map never calls a third party.
 *
 * 1. `EXPO_PUBLIC_TILES_URL` wins when set (see `.env.example`).
 * 2. In development, the host the Expo dev server runs on, port 3000.
 * 3. Otherwise localhost.
 */
export function getTilesBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_TILES_URL;
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  return `http://${getDevHost() ?? 'localhost'}:${TILE_SERVER_PORT}`;
}
