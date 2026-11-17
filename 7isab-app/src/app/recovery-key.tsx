import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { IslamicPattern } from '@/components/ui/islamic-pattern';
import { FontFamilies, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useDirection } from '@/hooks/use-direction';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/lib/session/session-provider';

/** Shown once, right after signup. The key is never stored or sent anywhere. */
export default function RecoveryKeyScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { pendingRecoveryKey, acknowledgeRecoveryKey } = useSession();
  const [confirmed, setConfirmed] = useState(false);
  const { direction } = useDirection();

  const groups = pendingRecoveryKey?.split('-') ?? [];

  return (
    <View style={[styles.root, { backgroundColor: theme.background, direction }]}>
      <IslamicPattern color={theme.pattern} opacity={0.05} />
      <SafeAreaView style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <AppText variant="title">{t('recovery.title')}</AppText>
            <AppText variant="body" color="textSecondary">
              {t('recovery.subtitle')}
            </AppText>
          </View>

          <View style={[styles.keyCard, { backgroundColor: theme.surface, borderColor: theme.accent }]}>
            {/* The key is Latin characters: always left-to-right, monospaced look. */}
            <View style={styles.keyGrid}>
              {groups.map((group, index) => (
                <View key={index} style={[styles.keyGroup, { backgroundColor: theme.accentSoft }]}>
                  <AppText
                    variant="heading"
                    weight="semibold"
                    align="center"
                    style={{ fontFamily: FontFamilies.latin.semibold, letterSpacing: 2, writingDirection: 'ltr' }}
                    selectable>
                    {group}
                  </AppText>
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.warning, { backgroundColor: theme.dangerSoft }]}>
            <AppText variant="label" color="danger">
              {t('recovery.warning')}
            </AppText>
          </View>

          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
            onPress={() => setConfirmed((value) => !value)}
            style={styles.checkRow}>
            <View
              style={[
                styles.checkbox,
                { borderColor: confirmed ? theme.primary : theme.border, backgroundColor: confirmed ? theme.primary : theme.surface },
              ]}>
              {confirmed ? (
                <AppText variant="caption" weight="bold" color="textOnPrimary">
                  ✓
                </AppText>
              ) : null}
            </View>
            <AppText variant="label" style={styles.checkLabel}>
              {t('recovery.confirm')}
            </AppText>
          </Pressable>

          <Button title={t('recovery.continue')} disabled={!confirmed} onPress={acknowledgeRecoveryKey} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    gap: Spacing.five,
  },
  heading: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  keyCard: {
    borderWidth: 1.5,
    borderRadius: Radius.large,
    padding: Spacing.four,
  },
  keyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.two,
    direction: 'ltr',
  },
  keyGroup: {
    minWidth: 76,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.small,
  },
  warning: {
    borderRadius: Radius.medium,
    padding: Spacing.four,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
  },
});
