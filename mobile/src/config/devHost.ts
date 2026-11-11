import Constants from 'expo-constants';

/**
 * Host name of the machine running the Expo dev server (e.g. "192.168.1.20"), or undefined
 * outside development. Simulators and phones on the same network can reach it, so the dev
 * backend and the dev tile server run there.
 */
export function getDevHost(): string | undefined {
  // e.g. "192.168.1.20:8081"; only present while running through the Expo CLI
  return Constants.expoConfig?.hostUri?.split(':')[0] || undefined;
}
