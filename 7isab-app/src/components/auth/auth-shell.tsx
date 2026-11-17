import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { IslamicPattern } from '@/components/ui/islamic-pattern';
import { LanguageSwitcher } from '@/components/ui/language-switcher';
import { ThemeSwitcher } from '@/components/ui/theme-switcher';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

type AuthShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
};

/**
 * Shared frame for sign-in / sign-up: patterned emerald header with an
 * arch-shaped emblem, then the form card.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const { direction, isRtl } = useDirection();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: theme.background, direction }]}>
      {/* Android draws edge-to-edge (SDK 54+), so the window no longer shrinks for the keyboard: pad on both platforms. */}
      <KeyboardAvoidingView style={styles.root} behavior="padding">
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + Spacing.five }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}>
          <View style={[styles.header, { backgroundColor: theme.hero }]}>
            <IslamicPattern color="#FFFFFF" opacity={0.12} />
            <SafeAreaView edges={['top']} style={styles.headerInner}>
              <View style={styles.toolbar}>
                <ThemeSwitcher compact />
              </View>
              <Image
                source={require('@/assets/images/splash-icon.png')}
                style={styles.emblem}
                resizeMode="contain"
                accessibilityIgnoresInvertColors
              />
              {/* The emblem already reads "حساب"; spell the name out for other languages. */}
              {isRtl ? null : (
                <AppText variant="title" color="onHero" align="center">
                  {t('app.name')}
                </AppText>
              )}
              <AppText variant="label" color="onHeroMuted" align="center">
                {t('app.tagline')}
              </AppText>
            </SafeAreaView>
          </View>

          <View style={styles.body}>
            <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <View style={[styles.goldRule, { backgroundColor: theme.accent }]} />
              <View style={styles.cardHeading}>
                <AppText variant="title">{title}</AppText>
                <AppText variant="body" color="textSecondary">
                  {subtitle}
                </AppText>
              </View>
              {children}
            </View>

            {footer}

            <LanguageSwitcher style={styles.languages} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    overflow: 'hidden',
    paddingBottom: Spacing.seven + Spacing.five,
    borderBottomLeftRadius: Radius.large * 2,
    borderBottomRightRadius: Radius.large * 2,
  },
  headerInner: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  toolbar: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: Spacing.two,
  },
  languages: {
    alignSelf: 'center',
  },
  emblem: {
    width: 112,
    height: 112,
    marginBottom: Spacing.one,
  },
  body: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    marginTop: -(Spacing.seven + Spacing.two),
    gap: Spacing.five,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.large,
    padding: Spacing.five,
    gap: Spacing.four,
    shadowColor: '#0F5C45',
    shadowOpacity: 0.08,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  goldRule: {
    alignSelf: 'center',
    width: 48,
    height: 3,
    borderRadius: 2,
  },
  cardHeading: {
    gap: Spacing.one,
  },
});
