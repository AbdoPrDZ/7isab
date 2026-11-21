import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { declineQuestion, getFatwaInbox, takeQuestion } from '@/lib/community/api';
import type { FatwaThreadSummary, QuestionForShaykh } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** A trusted shaykh's inbox: their conversations, and open questions for their gender. */
export default function FatwaInboxScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const [threads, setThreads] = useState<FatwaThreadSummary[] | null>(null);
  const [open, setOpen] = useState<QuestionForShaykh[]>([]);
  const [answering, setAnswering] = useState<number | null>(null);
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    getFatwaInbox(token)
      .then((result) => {
        if (cancelled) return;
        setThreads(result.threads);
        setOpen(result.open_questions);
      })
      .catch(() => !cancelled && router.back());
    return () => {
      cancelled = true;
    };
  }, [token]);

  useFocusEffect(load);

  const take = async (question: QuestionForShaykh) => {
    setBusy(true);
    try {
      const { thread } = await takeQuestion(token, question.id, text.trim(), answered);
      setAnswering(null);
      setText('');
      router.push({ pathname: '/community/fatwa-thread/[id]', params: { id: String(thread.id) } });
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setBusy(false);
    }
  };

  const decline = (question: QuestionForShaykh) =>
    Alert.alert(t('community.fatwa.declineTitle'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('community.fatwa.decline'),
        style: 'destructive',
        onPress: async () => {
          await declineQuestion(token, question.id).catch(() => undefined);
          load();
        },
      },
    ]);

  return (
    <Screen back title={t('community.fatwa.inbox')}>
      {!threads ? <ActivityIndicator color={theme.primary} style={styles.center} /> : null}

      <Section title={t('community.fatwa.conversations')}>
        {threads && threads.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.noConversations')}</AppText> : null}
        {threads?.map((thread) => (
          <Row
            key={thread.id}
            title={thread.question.body}
            subtitle={t(`community.fatwa.threadStatuses.${thread.status}`)}
            chevron
            onPress={() => router.push({ pathname: '/community/fatwa-thread/[id]', params: { id: String(thread.id) } })}
          />
        ))}
      </Section>

      <Section title={t('community.fatwa.openQuestions')}>
        <AppText variant="caption" color="textSecondary">
          {t('community.fatwa.openQuestionsHint')}
        </AppText>
        {open.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.noOpenQuestions')}</AppText> : null}
        {open.map((question) => (
          <Card key={question.id} style={styles.gap}>
            <AppText variant="caption" color="textSecondary">
              {question.asker_gender ? t(`community.fatwa.askedBy.${question.asker_gender}`) : t('community.fatwa.question')}
            </AppText>
            <AppText>{question.body}</AppText>
            {answering === question.id ? (
              <>
                <TextField label={t('community.fatwa.yourAnswer')} value={text} onChangeText={setText} multiline />
                <SwitchRow label={t('community.fatwa.markAnswered')} value={answered} onChange={setAnswered} />
                <Button title={t('community.comments.send')} loading={busy} disabled={!text.trim()} onPress={() => take(question)} />
                <Button title={t('common.cancel')} variant="ghost" onPress={() => setAnswering(null)} />
              </>
            ) : (
              <View style={styles.row}>
                <Button
                  title={t('community.fatwa.answerIt')}
                  style={styles.flex}
                  onPress={() => {
                    setAnswering(question.id);
                    setText('');
                    setAnswered(false);
                  }}
                />
                <Button title={t('community.fatwa.decline')} variant="ghost" style={styles.flex} onPress={() => decline(question)} />
              </View>
            )}
          </Card>
        ))}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  gap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
