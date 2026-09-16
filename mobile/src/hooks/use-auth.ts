import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { useCallback, useEffect, useState } from 'react';

import { fetchMe, loginWithGoogle, refreshTokens, type MeResponse } from '@/lib/api';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '@/lib/config';
import { clearTokens, loadTokens, saveTokens, type TokenPair } from '@/lib/tokenStorage';

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  iosClientId: GOOGLE_IOS_CLIENT_ID,
});

type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'signedIn'; user: MeResponse };

export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading' });
  const [error, setError] = useState<string | null>(null);

  const loadSession = useCallback(async () => {
    const tokens = await loadTokens();
    if (!tokens) {
      setState({ status: 'signedOut' });
      return;
    }
    try {
      const user = await fetchMe(tokens.accessToken);
      setState({ status: 'signedIn', user });
    } catch {
      try {
        const refreshed = await refreshTokens(tokens.refreshToken);
        await saveTokens(refreshed);
        const user = await fetchMe(refreshed.accessToken);
        setState({ status: 'signedIn', user });
      } catch {
        await clearTokens();
        setState({ status: 'signedOut' });
      }
    }
  }, []);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const signIn = useCallback(async () => {
    setError(null);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) {
        return;
      }
      const idToken = response.data.idToken;
      if (!idToken) {
        throw new Error('Google did not return an ID token');
      }
      const tokens: TokenPair = await loginWithGoogle(idToken);
      await saveTokens(tokens);
      const user = await fetchMe(tokens.accessToken);
      setState({ status: 'signedIn', user });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  }, []);

  const signOut = useCallback(async () => {
    await clearTokens();
    try {
      await GoogleSignin.signOut();
    } catch {
      // Local session is already cleared regardless of whether Google's own sign-out call succeeds.
    }
    setState({ status: 'signedOut' });
  }, []);

  return { state, error, signIn, signOut };
}
