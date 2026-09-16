import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchMe, loginWithGoogle, refreshAndSaveTokens, type MeResponse } from '@/lib/api';
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

type AuthContextValue = {
  state: AuthState;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// A single provider, mounted once at the app root, is the one and only place that reads or
// refreshes the token pair on launch. Screens that each ran their own copy of this logic would
// race independently on the same SecureStore keys whenever the access token needed refreshing.
export function AuthProvider({ children }: { children: ReactNode }) {
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
        const refreshed = await refreshAndSaveTokens(tokens.refreshToken);
        const user = await fetchMe(refreshed.accessToken);
        setState({ status: 'signedIn', user });
      } catch {
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

  return (
    <AuthContext.Provider value={{ state, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
