import { router } from 'expo-router';
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card, Divider, Section } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { SearchGroup, SearchItem } from '@/lib/search/search';

/** How many results a group shows before "Show all". */
const PREVIEW = 5;

export function SearchItemRow({ item, quranFont }: { item: SearchItem; quranFont?: string }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push(item.href)}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: theme.surfaceMuted }]}>
      <AppText variant="label" numberOfLines={3} style={item.arabic ? [styles.arabic, quranFont ? { fontFamily: quranFont, fontSize: 19, lineHeight: 34 } : null] : undefined}>
        {item.title}
      </AppText>
      {item.subtitle ? (
        <AppText variant="caption" color="textSecondary" numberOfLines={2}>
          {item.subtitle}
        </AppText>
      ) : null}
    </Pressable>
  );
}

/** One group of results with its own "Show all". */
export function SearchGroupCard({ title, items, quranFont }: { title: string; items: SearchItem[]; quranFont?: string }) {
  const { t } = useTranslation();
  const [all, setAll] = useState(false);
  const shown = all ? items : items.slice(0, PREVIEW);
  return (
    <Section
      title={`${title} (${items.length})`}
      action={
        items.length > PREVIEW ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setAll(!all)}>
            <AppText variant="label" color="primary">
              {all ? t('search.showLess') : t('search.showAll')}
            </AppText>
          </Pressable>
        ) : undefined
      }>
      <Card>
        {shown.map((item, index) => (
          <Fragment key={item.id}>
            {index > 0 ? <Divider /> : null}
            <SearchItemRow item={item} quranFont={quranFont} />
          </Fragment>
        ))}
      </Card>
    </Section>
  );
}

export function SearchGroups({ groups }: { groups: SearchGroup[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.groups}>
      {groups.map((group) => (
        <SearchGroupCard key={group.id} title={t(`search.groups.${group.id}`)} items={group.items} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: Spacing.four },
  item: { gap: 2, paddingVertical: Spacing.two },
  arabic: { writingDirection: 'rtl', textAlign: 'right', fontSize: 17, lineHeight: 28 },
});
