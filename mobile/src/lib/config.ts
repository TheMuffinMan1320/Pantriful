import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

function requireExtra(key: string): string {
  const value = extra[key];
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Missing "${key}" in app.json's expo.extra config`);
  }
  return value;
}

export const GOOGLE_WEB_CLIENT_ID = requireExtra('googleWebClientId');
export const GOOGLE_IOS_CLIENT_ID = requireExtra('googleIosClientId');
export const API_BASE_URL = requireExtra('apiBaseUrl');
