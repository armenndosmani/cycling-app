import * as SecureStore from 'expo-secure-store';

export type StoredTokens = {
  accessToken: string;
  refreshToken: string;
};

/** Where the session tokens live. The app implementation uses the Keychain / Keystore only. */
export type TokenStorage = {
  load(): Promise<StoredTokens | null>;
  save(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

const ACCESS_TOKEN_KEY = 'auth.accessToken';
const REFRESH_TOKEN_KEY = 'auth.refreshToken';

// Readable only while the phone is unlocked, never synced to iCloud or restored to another device.
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

/** Tokens are stored ONLY here: never in AsyncStorage, files or logs. */
export const secureTokenStorage: TokenStorage = {
  async load() {
    const [accessToken, refreshToken] = await Promise.all([
      SecureStore.getItemAsync(ACCESS_TOKEN_KEY, options),
      SecureStore.getItemAsync(REFRESH_TOKEN_KEY, options),
    ]);
    return accessToken && refreshToken ? { accessToken, refreshToken } : null;
  },

  async save({ accessToken, refreshToken }) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken, options);
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken, options);
  },

  async clear() {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY, options),
      SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, options),
    ]);
  },
};
