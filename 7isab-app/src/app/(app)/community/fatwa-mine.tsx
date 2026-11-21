import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Row, Screen } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { closeQuestion, getMyQuestions } from '@/lib/community/api';
import type { MyQuestion } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** The member's questions, each with one thread per shaykh who took it. */
export default function MyQuestionsScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [questions, setQuestions] = useState<MyQuestion[] | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    getMyQuestions(token)
      .then((result) => !cancelled && setQuestions(result.questions))
      .catch(() => !cancelled && setQuestions([]));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  const close = (question: MyQuestion) =>
    Alert.alert(t('community.fatwa.closeTitle'), t('community.fatwa.closeHint'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.fatwa.close'),
        onPress: async () => {
          await closeQuestion(token, question.id).catch(() => undefined);
          load();
        },
      },
    ]);

  return (
    <Screen back title={t('community.fatwa.myQuestions')}>
      {!questions ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}
      {questions && questions.length === 0 ? (
        <AppText color="textSecondary" align="center" style={styles.center}>
          {t('community.fatwa.noQuestions')}
        </AppText>
      ) : null}
      {questions?.map((question) => (
        <Card key={question.id} style={styles.question}>
          <AppText variant="caption" color="textSecondary">
            {question.target_shaykh
              ? t('community.fatwa.toShaykh', { name: `${question.target_shaykh.first_name} ${question.target_shaykh.last_name}` })
              : t(`community.fatwa.toAllOf.${question.shaykh_gender}`)}
            {' · '}
            {t(`community.fatwa.questionStatuses.${question.status}`)}
          </AppText>
          <AppText>{question.body}</AppText>
          {question.threads.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.waiting')}</AppText> : null}
          {question.threads.map((thread) => (
            <Row
              key={thread.id}
              title={thread.shaykh ? `${thread.shaykh.first_name} ${thread.shaykh.last_name}` : t('community.fatwa.shaykh')}
              subtitle={
                thread.publication && !thread.publication.published_at
                  ? t('community.fatwa.proposalWaiting')
                  : t(`community.fatwa.threadStatuses.${thread.status}`)
              }
              chevron
              onPress={() => router.push({ pathname: '/community/fatwa-thread/[id]', params: { id: String(thread.id) } })}
            />
          ))}
          {question.status !== 'closed' ? <Button title={t('community.fatwa.close')} variant="ghost" onPress={() => close(question)} /> : null}
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  question: { gap: Spacing.two },
});
