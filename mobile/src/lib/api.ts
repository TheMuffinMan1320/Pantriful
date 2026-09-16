import { API_BASE_URL } from '@/lib/config';
import type { TokenPair } from '@/lib/tokenStorage';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new ApiError(response.status, `${path} failed with status ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function loginWithGoogle(idToken: string): Promise<TokenPair> {
  return postJson<TokenPair>('/auth/oauth/google', { idToken });
}

export function refreshTokens(refreshToken: string): Promise<TokenPair> {
  return postJson<TokenPair>('/auth/refresh', { refreshToken });
}

export type MeResponse = {
  id: string;
  email: string;
  displayName: string | null;
};

export async function fetchMe(accessToken: string): Promise<MeResponse> {
  const response = await fetch(`${API_BASE_URL}/me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, `/me failed with status ${response.status}`);
  }
  return response.json() as Promise<MeResponse>;
}
