import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

import { AppText } from './app-text';
import { BackIcon } from './icons';
import { IslamicPattern } from './islamic-pattern';

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  /** Shows a back button with this label; leave out on tab screens. */
  backLabel?: string;
  /** Content before the title (after the back button). */
  start?: ReactNode;
  /** Extra content on the end side of the title row. */
  end?: ReactNode;
  /** Puts the start and end content on their own row, with the title and subtitle on the row below. */
  stacked?: boolean;
};

/** Emerald patterned header with a back button that points the right way in RTL. */
export function ScreenHeader({ title, subtitle, backLabel, start, end, stacked = false }: ScreenHeaderProps) {
  const theme = useTheme();
  const { isRtl } = useDirection();

  const titles = (
    <View style={styles.titles}>
      <AppText variant="heading" color="onHero">
        {title}
      </AppText>
      {subtitle ? (
        <AppText variant="caption" color="onHeroMuted">
          {subtitle}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.header, { backgroundColor: theme.hero }]}>
      <IslamicPattern color="#FFFFFF" opacity={0.08} />
      <SafeAreaView edges={['top']} style={styles.inner}>
        <View style={styles.row}>
          {backLabel ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={backLabel}
              hitSlop={10}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.back, { opacity: pressed ? 0.6 : 1 }]}>
              <BackIcon size={26} color={theme.onHero} flip={isRtl} />
            </Pressable>
          ) : null}
          {start}
          {stacked ? <View style={styles.spacer} /> : titles}
          {end}
        </View>
        {stacked ? <View style={styles.stackedTitles}>{titles}</View> : null}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    overflow: 'hidden',
    borderBottomLeftRadius: Radius.large,
    borderBottomRightRadius: Radius.large,
  },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  back: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titles: {
    flex: 1,
  },
  spacer: {
    flex: 1,
  },
  stackedTitles: {
    marginTop: Spacing.three,
  },
});
