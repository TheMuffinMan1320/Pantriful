import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { LabelCard } from '@/components/label-card';
import { StampBadge } from '@/components/stamp-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { useTheme } from '@/hooks/use-theme';

export default function HomeScreen() {
  const { state, error, signIn, signOut } = useAuth();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wordmarkBlock}>
          <ThemedText type="title" style={styles.wordmark}>
            PANTRIFUL
          </ThemedText>
          <BarcodeRule seed="pantriful-home" height={16} />
          <ThemedText type="label" themeColor="textSecondary" style={styles.tagline}>
            Kitchen inventory, tracked and dated
          </ThemedText>
        </View>

        {state.status === 'loading' && <ActivityIndicator color={theme.accent} />}

        {state.status === 'signedOut' && (
          <LabelCard style={styles.card}>
            <ThemedText type="label" themeColor="textSecondary">
              Status
            </ThemedText>
            <ThemedText type="subtitle">Sign in to see your pantry</ThemedText>
            <GoogleSigninButton
              size={GoogleSigninButton.Size.Wide}
              color={GoogleSigninButton.Color.Dark}
              onPress={signIn}
              style={styles.googleButton}
            />
            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}
          </LabelCard>
        )}

        {state.status === 'signedIn' && (
          <LabelCard style={styles.card}>
            <View style={styles.signedInRow}>
              <View style={styles.signedInInfo}>
                <ThemedText type="label" themeColor="textSecondary">
                  Status
                </ThemedText>
                <ThemedText type="subtitle">Signed in</ThemedText>
                <ThemedText type="data" themeColor="textSecondary">
                  {state.user.email}
                </ThemedText>
              </View>
              <StampBadge label="ACTIVE" color={theme.fresh} />
            </View>
            <BarcodeRule seed={state.user.email} />
            <Pressable onPress={signOut} hitSlop={8}>
              <ThemedText type="linkPrimary">Sign out</ThemedText>
            </Pressable>
          </LabelCard>
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
    gap: Spacing.five,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
    alignSelf: 'stretch',
  },
  wordmarkBlock: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  wordmark: {
    letterSpacing: 2,
  },
  tagline: {
    textTransform: 'none',
    letterSpacing: 0.2,
  },
  card: {
    gap: Spacing.three,
    alignSelf: 'stretch',
  },
  googleButton: {
    alignSelf: 'flex-start',
  },
  signedInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  signedInInfo: {
    gap: Spacing.half,
    flex: 1,
  },
});
