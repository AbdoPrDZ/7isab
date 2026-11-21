import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCommunityRules } from '@/lib/community/api';
import { ruleText } from '@/lib/community/membership';
import type { CommunityRule } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** The community rules the member accepted, to read again. */
export default function CommunityRulesScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [rules, setRules] = useState<CommunityRule[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getCommunityRules(token)
      .then((result) => !cancelled && setRules(result.rules))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const retry = () => {
    setFailed(false);
    setAttempt((value) => value + 1);
  };

  return (
    <Screen back title={t('community.menu.rules')}>
      {failed ? (
        <View style={styles.center}>
          <AppText color="textSecondary" align="center">
            {t('community.loadFailed')}
          </AppText>
          <Button title={t('community.retry')} variant="secondary" onPress={retry} />
        </View>
      ) : null}
      {!rules && !failed ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : null}
      {rules?.map((rule, index) => (
        <Card key={rule.key} style={styles.rule}>
          <AppText variant="caption" color="textSecondary">
            {t('community.join.ruleN', { n: index + 1, count: rules.length })}
          </AppText>
          <AppText>{ruleText(rule, i18n.language)}</AppText>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six, gap: Spacing.three, alignItems: 'center' },
  rule: { gap: Spacing.one },
});
