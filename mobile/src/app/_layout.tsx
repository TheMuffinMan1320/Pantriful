/**
 * DIRECTION CONTRACT
 * THESIS: A kitchen inventory app should read as real printed inventory data - stamped,
 * barcoded, dated - never as a generic recipe-blog card grid or a bare CRUD list.
 * OWN-WORLD: Konbini Label System. Warm kraft canvas (#F1EAD9) under brighter label-stock
 * cards (#FFFCF4), one stamp-ink red accent (#BE3A26), Space Grotesk for names/headings,
 * Space Mono for every number (quantity, date, threshold), dashed die-cut card borders,
 * a deterministic barcode rule under each item, a rotated circular stamp for low-stock/made.
 * STORY: A user opens the app and immediately reads it as "my real pantry, labeled and
 * dated," not a to-do list; low stock and a made recipe both resolve as a physical stamp,
 * not a colored badge.
 * FIRST VIEWPORT: Home shows a signed-out state as a single kraft-toned label card centered
 * on the canvas with the Google sign-in action; signed-in shows a stamped "signed in" label.
 * FORM: assigned direction from concept-seed (mode: operate, seed 07567a1d, index 7 of 7
 * grounded candidates), raised with disciplines borrowed from 4 declined catalog challengers
 * (single global expand-all control, one continuous freshness variable, urgency-by-type-weight,
 * dismissed alerts move to a tray rather than vanish).
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
 * the verdict, DESIGN.md, and every shipping raster carrying its provenance.
 */
import {
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import AppTabs from '@/components/app-tabs';
import { AuthProvider } from '@/context/auth-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <AppTabs />
      </AuthProvider>
    </ThemeProvider>
  );
}
