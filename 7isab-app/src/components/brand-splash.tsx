import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, useColorScheme } from 'react-native';

import { IslamicPattern } from '@/components/ui/islamic-pattern';
import { Colors } from '@/constants/theme';

const EMBLEM_SIZE = 200;
const FADE_OUT_MS = 450;

type BrandSplashProps = {
  /** Fonts and session are ready: fade out. */
  ready: boolean;
  /** Called after the fade-out, to unmount the overlay. */
  onFinished: () => void;
};

/**
 * JS copy of the native splash (same background and emblem at the same size),
 * so the hand-off is invisible. It adds the pattern and a gentle pulse while
 * loading, then fades out. Also shows in Expo Go, where the native splash can't.
 */
export function BrandSplash({ ready, onFinished }: BrandSplashProps) {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const background = isDark ? Colors.dark.background : Colors.light.primary;

  const [opacity] = useState(() => new Animated.Value(1));
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  useEffect(() => {
    if (!ready) return;
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_OUT_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start(({ finished }) => finished && onFinished());
  }, [ready, opacity, onFinished]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
  const exitScale = opacity.interpolate({ inputRange: [0, 1], outputRange: [1.08, 1] });

  return (
    <Animated.View
      pointerEvents={ready ? 'none' : 'auto'}
      // Hide the native splash only once this identical copy is on screen.
      onLayout={() => void SplashScreen.hideAsync()}
      style={[StyleSheet.absoluteFill, styles.container, { backgroundColor: background, opacity }]}>
      <IslamicPattern color={isDark ? Colors.dark.primary : '#FFFFFF'} opacity={0.08} size={64} />
      <Animated.View style={{ transform: [{ scale }, { scale: exitScale }] }}>
        <Image
          source={isDark ? require('@/assets/images/splash-icon-dark.png') : require('@/assets/images/splash-icon.png')}
          style={styles.emblem}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    elevation: 100,
  },
  emblem: {
    width: EMBLEM_SIZE,
    height: EMBLEM_SIZE,
  },
});
