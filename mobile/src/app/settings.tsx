import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarcodeRule } from '@/components/barcode-rule';
import { Icon } from '@/components/icon';
import { LabelCard } from '@/components/label-card';
import { StampBadge } from '@/components/stamp-badge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { registerForPushNotifications } from '@/lib/pushNotifications';
import { useTheme } from '@/hooks/use-theme';

type NotificationStatus = 'unknown' | 'granted' | 'denied' | 'undetermined';

export default function SettingsScreen() {
  const { state, error, signIn, signOut } = useAuth();
  const theme = useTheme();
  const [notifStatus, setNotifStatus] = useState<NotificationStatus>('unknown');
  const [requesting, setRequesting] = useState(false);

  const refreshNotifStatus = useCallback(async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setNotifStatus(status as NotificationStatus);
    } catch {
      setNotifStatus('unknown');
    }
  }, []);

  useEffect(() => {
    refreshNotifStatus();
    // Permission can only be changed from the OS Settings app once granted or denied, so
    // re-check whenever the app comes back to the foreground (e.g. after the user flips it there).
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        refreshNotifStatus();
      }
    });
    return () => subscription.remove();
  }, [refreshNotifStatus]);

  const onEnableNotifications = useCallback(async () => {
    setRequesting(true);
    try {
      await registerForPushNotifications();
    } finally {
      await refreshNotifStatus();
      setRequesting(false);
    }
  }, [refreshNotifStatus]);

  const onToggleNotifications = useCallback(() => {
    // iOS only shows the native permission prompt once; after a decision (granted or denied)
    // the only way to change it is the OS Settings app, so route there instead of a silent no-op.
    if (notifStatus === 'granted' || notifStatus === 'denied') {
      Linking.openSettings();
    } else {
      onEnableNotifications();
    }
  }, [notifStatus, onEnableNotifications]);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Settings
            </ThemedText>
            <BarcodeRule seed="pantriful-settings" height={12} />
          </View>

          <Section label="Account">
            {state.status === 'loading' && (
              <LabelCard style={styles.card}>
                <ActivityIndicator color={theme.accent} />
              </LabelCard>
            )}

            {state.status === 'signedOut' && (
              <LabelCard style={styles.card}>
                <ThemedText type="label" themeColor="textSecondary">
                  Status
                </ThemedText>
                <ThemedText type="subtitle">Signed out</ThemedText>
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
                  <ThemedText type="linkPrimary" style={{ color: theme.danger }}>
                    Sign out
                  </ThemedText>
                </Pressable>
              </LabelCard>
            )}
          </Section>

          <Section label="Notifications">
            <Pressable onPress={onToggleNotifications} disabled={requesting} hitSlop={8}>
              {({ pressed }) => (
                <LabelCard style={[styles.card, pressed && styles.cardPressed]}>
                  <View style={styles.rowBetween}>
                    <View style={styles.signedInInfo}>
                      <ThemedText type="label" themeColor="textSecondary">
                        Low-stock alerts
                      </ThemedText>
                      <ThemedText type="subtitle">
                        {notifStatus === 'granted' ? 'Enabled' : 'Disabled'}
                      </ThemedText>
                    </View>
                    <StampBadge
                      label={notifStatus === 'granted' ? 'ON' : 'OFF'}
                      color={notifStatus === 'granted' ? theme.fresh : theme.textSecondary}
                    />
                  </View>
                  <ThemedText type="linkPrimary">
                    {requesting
                      ? 'Requesting…'
                      : notifStatus === 'granted' || notifStatus === 'denied'
                        ? 'Open Settings'
                        : 'Tap to enable'}
                  </ThemedText>
                </LabelCard>
              )}
            </Pressable>
          </Section>

          <Section label="About">
            <LabelCard style={styles.card}>
              <View style={styles.rowBetween}>
                <View style={styles.signedInInfo}>
                  <ThemedText type="label" themeColor="textSecondary">
                    App
                  </ThemedText>
                  <ThemedText type="subtitle">Pantriful</ThemedText>
                </View>
                <Icon name="shippingbox.fill" size={28} color={theme.accent} />
              </View>
              <ThemedText type="data" themeColor="textSecondary">
                Version {appVersion}
              </ThemedText>
            </LabelCard>
          </Section>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="label" themeColor="textSecondary" style={styles.sectionLabel}>
        {label}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    alignSelf: 'stretch',
  },
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.three,
    gap: Spacing.five,
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    width: '100%',
  },
  header: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 30,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    marginLeft: Spacing.one,
  },
  card: {
    gap: Spacing.three,
  },
  cardPressed: {
    opacity: 0.7,
  },
  googleButton: {
    alignSelf: 'flex-start',
  },
  signedInRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  signedInInfo: {
    gap: Spacing.half,
    flex: 1,
  },
});
