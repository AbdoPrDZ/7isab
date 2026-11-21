import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import type { PublishedFatwa } from '@/lib/community/types';

/** Preview length of the answer before "Read more". */
const PREVIEW = 280;

/** A published fatwa with the shaykh's name, manhaj and marja', and the note that it answers that question. */
export function FatwaCard({ fatwa }: { fatwa: PublishedFatwa }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const long = fatwa.answer.length > PREVIEW;

  return (
    <Card style={styles.card}>
      <AppText variant="caption" color="textSecondary">
        {fatwa.asker_gender ? t(`community.fatwa.askedBy.${fatwa.asker_gender}`) : t('community.fatwa.question')}
      </AppText>
      <AppText weight="semibold">{fatwa.question}</AppText>
      <AppText>{expanded || !long ? fatwa.answer : `${fatwa.answer.slice(0, PREVIEW)}…`}</AppText>
      {long ? (
        <Pressable accessibilityRole="button" onPress={() => setExpanded(!expanded)}>
          <AppText variant="caption" weight="semibold" color="primary">
            {expanded ? t('community.fatwa.less') : t('community.fatwa.more')}
          </AppText>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push({ pathname: '/community/shaykh/[id]', params: { id: String(fatwa.shaykh.id) } })}>
        <AppText variant="caption" weight="semibold" color="primary">
          {fatwa.shaykh.first_name} {fatwa.shaykh.last_name}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {t('community.fatwa.manhajLine', { manhaj: fatwa.shaykh.manhaj, marja: fatwa.shaykh.marja })}
        </AppText>
      </Pressable>
      <AppText variant="caption" color="textSecondary">
        {t('community.fatwa.specificNote')}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
});
