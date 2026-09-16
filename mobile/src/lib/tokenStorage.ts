import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'pantriful.accessToken';
const REFRESH_TOKEN_KEY = 'pantriful.refreshToken';

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export async function saveTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export async function loadTokens(): Promise<TokenPair | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
  ]);
  if (!accessToken || !refreshToken) {
    return null;
  }
  return { accessToken, refreshToken };
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
