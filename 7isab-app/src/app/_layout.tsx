import '@/global.css';

import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from '@expo-google-fonts/ibm-plex-sans-arabic';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
import { useFonts } from 'expo-font';
import { OTAProvider } from 'expo-ota-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useState } from 'react';
import { StyleSheet, useColorScheme, View } from 'react-native';

import { BrandSplash } from '@/components/brand-splash';
import { KeyLockedScreen } from '@/components/key-locked-screen';
import { Colors } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { disableNativeRtl } from '@/i18n';
import { applyStoredThemePreference } from '@/lib/preferences/theme';
import { SessionProvider, useSession } from '@/lib/session/session-provider';

SplashScreen.preventAutoHideAsync();
disableNativeRtl();
applyStoredThemePreference();

/**
 * Which screens exist depends on the session:
 * signed out → sign-in / sign-up; just signed up → recovery key; signed in → app.
 */
function RootNavigator() {
  const { status, pendingRecoveryKey } = useSession();
  const { direction } = useDirection();
  const signedIn = status === 'signedIn';

  // The data key is behind a fingerprint check that failed or was cancelled.
  if (status === 'keyLocked') {
    return (
      <View style={[styles.root, { direction }]}>
        <KeyLockedScreen />
      </View>
    );
  }

  return (
    // The whole UI follows the language direction (Arabic: right-to-left).
    <View style={[styles.root, { direction }]}>
      <Navigator signedIn={signedIn} pendingRecoveryKey={pendingRecoveryKey} />
    </View>
  );
}

function Navigator({ signedIn, pendingRecoveryKey }: { signedIn: boolean; pendingRecoveryKey: string | null }) {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
      <Stack.Protected guard={signedIn && !pendingRecoveryKey}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !!pendingRecoveryKey}>
        <Stack.Screen name="recovery-key" options={{ gestureEnabled: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
        <Stack.Screen name="recover" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});

/**
 * Shows the branded splash until fonts and the saved session are ready,
 * then mounts the app underneath and fades the splash out.
 */
function SplashGate({ fontsReady }: { fontsReady: boolean }) {
  const { status } = useSession();
  const ready = fontsReady && status !== 'loading';
  const [splashVisible, setSplashVisible] = useState(true);
  const hideSplash = useCallback(() => setSplashVisible(false), []);

  return (
    <View style={styles.root}>
      {ready ? <RootNavigator /> : null}
      {splashVisible ? <BrandSplash ready={ready} onFinished={hideSplash} /> : null}
    </View>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  const [fontsLoaded, fontError] = useFonts({
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
    AmiriQuran_400Regular,
  });

  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const colors = Colors[scheme === 'dark' ? 'dark' : 'light'];
  const navigationTheme = {
    ...base,
    colors: { ...base.colors, background: colors.background, card: colors.surface, primary: colors.primary, text: colors.text, border: colors.border },
  };

  return (
    <OTAProvider onError={(error) => console.warn('[OTA]', error)}>
      <ThemeProvider value={navigationTheme}>
        <SessionProvider>
          <StatusBar style="light" />
          <SplashGate fontsReady={fontsLoaded || !!fontError} />
        </SessionProvider>
      </ThemeProvider>
    </OTAProvider>
  );
}
