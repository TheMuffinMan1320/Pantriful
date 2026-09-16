import { API_BASE_URL } from '@/lib/config';
import { clearTokens, loadTokens, saveTokens, type TokenPair } from '@/lib/tokenStorage';

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

// Every caller that hits a 401 (the /me check on launch, any inventory call, etc.) needs to
// refresh the same underlying token pair. Without deduplication, two callers racing on an
// expired access token would each fire their own refresh + save + clear-on-failure sequence
// and could stomp on each other's writes to SecureStore. Sharing one in-flight promise means
// only the first caller actually calls the network; everyone else awaits that same result.
let refreshInFlight: Promise<TokenPair> | null = null;

export function refreshAndSaveTokens(refreshToken: string): Promise<TokenPair> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const refreshed = await refreshTokens(refreshToken);
        await saveTokens(refreshed);
        return refreshed;
      } catch (err) {
        await clearTokens();
        throw err;
      } finally {
        refreshInFlight = null;
      }
    })();
  }
  return refreshInFlight;
}

async function requestWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const tokens = await loadTokens();
  if (!tokens) {
    throw new ApiError(401, 'Not signed in');
  }

  const withToken = (accessToken: string) =>
    fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await withToken(tokens.accessToken);

  if (response.status === 401) {
    try {
      const refreshed = await refreshAndSaveTokens(tokens.refreshToken);
      response = await withToken(refreshed.accessToken);
    } catch {
      throw new ApiError(401, 'Session expired');
    }
  }

  return response;
}

async function authedJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await requestWithAuth(path, init);
  if (!response.ok) {
    throw new ApiError(response.status, `${path} failed with status ${response.status}`);
  }
  if (response.status === 204) {
    return undefined as T;
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

export type InventoryItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string | null;
  expirationDate: string | null;
  lowStockThreshold: number | null;
  imageUrl: string | null;
};

export type UpsertInventoryItemInput = {
  name: string;
  quantity: number;
  unit: string;
  category?: string | null;
  expirationDate?: string | null;
  lowStockThreshold?: number | null;
};

export function listInventory(): Promise<InventoryItem[]> {
  return authedJson<InventoryItem[]>('/inventory');
}

export function createInventoryItem(input: UpsertInventoryItemInput): Promise<InventoryItem> {
  return authedJson<InventoryItem>('/inventory', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateInventoryItem(
  id: string,
  input: UpsertInventoryItemInput,
): Promise<InventoryItem> {
  return authedJson<InventoryItem>(`/inventory/${id}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteInventoryItem(id: string): Promise<void> {
  return authedJson<void>(`/inventory/${id}`, { method: 'DELETE' });
}
