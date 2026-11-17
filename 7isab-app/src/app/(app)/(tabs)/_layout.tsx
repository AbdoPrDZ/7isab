import { Tabs, type BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { BeadsIcon, BookIcon, HomeIcon, ScaleIcon, WalletIcon, type IconProps } from '@/components/ui/icons';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

const TABS: { name: string; label: string; Icon: (props: IconProps) => ReactNode }[] = [
  { name: 'index', label: 'tabs.today', Icon: HomeIcon },
  { name: 'quran', label: 'tabs.quran', Icon: BookIcon },
  { name: 'athkar', label: 'tabs.athkar', Icon: BeadsIcon },
  { name: 'wallet', label: 'tabs.wallet', Icon: WalletIcon },
  { name: 'hisab', label: 'tabs.hisab', Icon: ScaleIcon },
];

/** Themed tab bar with SVG icons; follows the language direction. */
function TabBar({ state, navigateToTab }: BottomTabBarProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { direction } = useDirection();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: theme.surface, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.one, direction },
      ]}>
      {state.routes.map((route, index) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const focused = state.index === index;
        const color = focused ? theme.primary : theme.textSecondary;

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={t(tab.label)}
            onPress={() => {
              if (!focused) navigateToTab(route.key);
            }}
            style={styles.tab}>
            <View style={[styles.iconWrap, focused && { backgroundColor: theme.primarySoft }]}>
              <tab.Icon size={22} color={color} />
            </View>
            <AppText variant="caption" weight={focused ? 'semibold' : 'regular'} color={focused ? 'primary' : 'textSecondary'}>
              {t(tab.label)}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.one },
  iconWrap: { paddingHorizontal: Spacing.three, paddingVertical: 4, borderRadius: 999 },
});
