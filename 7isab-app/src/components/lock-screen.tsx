import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BackIcon, FingerprintIcon } from '@/components/ui/icons';
import { IslamicPattern } from '@/components/ui/islamic-pattern';
import { Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { useFormat } from '@/lib/format';
import { submitPin, unlockWithBiometrics, useLockStore } from '@/lib/lock/app-lock';
import { useSession } from '@/lib/session/session-provider';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'bio', '0', 'del'] as const;
const MAX_PIN = 8;

/** Full-screen lock: PIN pad, with fingerprint when that mode is on. */
export function LockScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const format = useFormat();
  const { direction, isRtl } = useDirection();
  const { signOut } = useSession();
  const mode = useLockStore((state) => state.mode);
  const lockedUntil = useLockStore((state) => state.lockedUntil);
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const waiting = Math.max(0, Math.ceil((lockedUntil - now) / 1000));

  const tryBiometric = () =>
    void unlockWithBiometrics(t('lock.biometricPrompt'), t('common.cancel')).catch(() => undefined);

  // Ask for the fingerprint right away when that's the chosen lock.
  useEffect(() => {
    if (mode === 'biometric') {
      void unlockWithBiometrics(t('lock.biometricPrompt'), t('common.cancel')).catch(() => undefined);
    }
  }, [mode, t]);

  // Count down a lockout.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [lockedUntil]);

  const submit = (value: string) => {
    const result = submitPin(value);
    setPin('');
    if (result === 'wrong') setMessage(t('lock.wrongPin'));
    else if (result === 'lockedOut') {
      setNow(Date.now());
      setMessage(null);
    } else if (result === 'signOut') void signOut();
  };

  const press = (key: (typeof KEYS)[number]) => {
    if (waiting > 0) return;
    if (key === 'bio') return tryBiometric();
    if (key === 'del') return setPin((value) => value.slice(0, -1));
    const next = (pin + key).slice(0, MAX_PIN);
    setPin(next);
    setMessage(null);
  };

  return (
    <View style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: theme.hero, direction }]}>
      <IslamicPattern color="#FFFFFF" opacity={0.06} />
      <SafeAreaView style={styles.inner}>
        <View style={styles.top}>
          <AppText variant="title" color="onHero" align="center">
            {t('lock.title')}
          </AppText>
          <AppText variant="label" color="onHeroMuted" align="center">
            {waiting > 0 ? t('lock.lockedOut', { seconds: format.digits(waiting) }) : (message ?? t('lock.enterPin'))}
          </AppText>
          <View style={styles.dots}>
            {Array.from({ length: Math.max(4, pin.length) }, (_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { borderColor: theme.onHeroMuted, backgroundColor: index < pin.length ? theme.accent : 'transparent' },
                ]}
              />
            ))}
          </View>
        </View>

        <View style={styles.pad}>
          {KEYS.map((key) => {
            if (key === 'bio' && mode !== 'biometric') return <View key={key} style={styles.key} />;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === 'del' ? t('lock.delete') : key === 'bio' ? t('lock.useBiometric') : key}
                onPress={() => press(key)}
                onLongPress={key === 'del' ? () => setPin('') : undefined}
                style={({ pressed }) => [
                  styles.key,
                  { backgroundColor: pressed ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)' },
                ]}>
                {key === 'bio' ? (
                  <FingerprintIcon size={28} color={theme.onHero} />
                ) : key === 'del' ? (
                  <BackIcon size={26} color={theme.onHero} flip={isRtl} />
                ) : (
                  <AppText variant="title" color="onHero">
                    {format.digits(key)}
                  </AppText>
                )}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.bottom}>
          <Pressable
            accessibilityRole="button"
            disabled={pin.length < 4 || waiting > 0}
            onPress={() => submit(pin)}
            style={({ pressed }) => [
              styles.unlock,
              { backgroundColor: theme.accent, opacity: pin.length < 4 || waiting > 0 ? 0.4 : pressed ? 0.8 : 1 },
            ]}>
            <AppText variant="label" weight="semibold" color="hero" align="center">
              {t('common.confirm')}
            </AppText>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void signOut()} hitSlop={8}>
            <AppText variant="caption" color="onHeroMuted" align="center">
              {t('lock.signOut')}
            </AppText>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { zIndex: 100, elevation: 100 },
  inner: { flex: 1, justifyContent: 'space-between', padding: Spacing.five },
  top: { alignItems: 'center', gap: Spacing.three, marginTop: Spacing.six },
  dots: { flexDirection: 'row', gap: Spacing.three, marginTop: Spacing.three, direction: 'ltr' },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5 },
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.four,
    maxWidth: 300,
    alignSelf: 'center',
    direction: 'ltr',
  },
  key: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
  bottom: { gap: Spacing.four },
  unlock: { borderRadius: Radius.medium, paddingVertical: Spacing.three },
});
