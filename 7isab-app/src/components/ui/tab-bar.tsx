import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import type { IconProps } from '@/components/ui/icons';
import { Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';

/** One tab: its route name, the i18n key of its label, and its icon. */
export type TabItem = { name: string; label: string; Icon: (props: IconProps) => ReactNode };

/** Themed tab bar with SVG icons; follows the language direction. */
export function TabBar({ state, navigateToTab, tabs }: BottomTabBarProps & { tabs: TabItem[] }) {
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
        const tab = tabs.find((item) => item.name === route.name);
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

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: Spacing.one },
  iconWrap: { paddingHorizontal: Spacing.three, paddingVertical: 4, borderRadius: 999 },
});
