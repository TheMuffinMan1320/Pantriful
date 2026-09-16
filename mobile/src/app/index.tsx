import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

export default function HomeScreen() {
  const { state, error, signIn, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Pantriful
        </ThemedText>

        {state.status === 'loading' && <ActivityIndicator />}

        {state.status === 'signedOut' && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText>Sign in to see your pantry.</ThemedText>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={signIn}
            />
            {error && (
              <ThemedText type="small" style={styles.error}>
                {error}
              </ThemedText>
            )}
          </ThemedView>
        )}

        {state.status === 'signedIn' && (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText type="subtitle">Signed in</ThemedText>
            <ThemedText>{state.user.email}</ThemedText>
            <Pressable onPress={signOut}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
          </ThemedView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  title: {
    textAlign: 'center',
  },
  card: {
    gap: Spacing.three,
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
  error: {
    color: '#d33',
  },
});
