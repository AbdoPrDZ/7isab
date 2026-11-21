import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { OptionsSheet, ReportSheet, type SheetOption } from '@/components/community/sheets';
import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  decidePublication,
  declineThread,
  getFatwaThread,
  getShaykhs,
  proposePublish,
  referThread,
  sendFatwaMessage,
} from '@/lib/community/api';
import type { FatwaThreadDetail, ShaykhProfile } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/**
 * One shaykh's conversation with the asker about a question. The shaykh never
 * sees who asked. A fatwa is published only when the shaykh proposes the text
 * and the asker approves it.
 */
export default function FatwaThreadScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const threadId = Number(id);
  const [thread, setThread] = useState<FatwaThreadDetail | null>(null);
  const [text, setText] = useState('');
  const [answered, setAnswered] = useState(false);
  const [sending, setSending] = useState(false);
  const [proposing, setProposing] = useState<{ question: string; answer: string } | null>(null);
  const [referring, setReferring] = useState<ShaykhProfile[] | null>(null);
  const [options, setOptions] = useState<SheetOption[] | null>(null);
  const [reporting, setReporting] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    getFatwaThread(token, threadId)
      .then((result) => !cancelled && setThread(result.thread))
      .catch(() => !cancelled && router.back());
    return () => {
      cancelled = true;
    };
  }, [token, threadId]);

  useFocusEffect(load);

  const run = async (action: () => Promise<unknown>, after?: () => void) => {
    setSending(true);
    try {
      await action();
      after?.();
      load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSending(false);
    }
  };

  if (!thread) {
    return (
      <Screen back title={t('community.fatwa.thread')}>
        <ActivityIndicator size="large" color={theme.primary} style={styles.center} />
      </Screen>
    );
  }

  const isShaykh = thread.role === 'shaykh';
  const active = (thread.status === 'open' || thread.status === 'answered') && thread.question.status !== 'closed';
  const proposal = thread.publication && !thread.publication.published_at ? thread.publication : null;
  const lastShaykhMessage = [...thread.messages].reverse().find((message) => message.from === 'shaykh');

  const shaykhOptions: SheetOption[] = [
    {
      label: t('community.fatwa.propose'),
      onPress: () => setProposing({ question: thread.question.body, answer: lastShaykhMessage?.body ?? '' }),
    },
    {
      label: t('community.fatwa.refer'),
      onPress: async () => setReferring((await getShaykhs(token).catch(() => ({ shaykhs: [] }))).shaykhs),
    },
    {
      label: t('community.fatwa.decline'),
      destructive: true,
      onPress: () =>
        Alert.alert(t('community.fatwa.declineTitle'), undefined, [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('community.fatwa.decline'), style: 'destructive', onPress: () => run(() => declineThread(token, threadId), () => router.back()) },
        ]),
    },
    { label: t('community.report.action'), onPress: () => setReporting(true) },
  ];

  return (
    <Screen
      back
      title={isShaykh ? t('community.fatwa.question') : `${thread.shaykh?.first_name ?? ''} ${thread.shaykh?.last_name ?? ''}`}
      subtitle={t(`community.fatwa.threadStatuses.${thread.status}`)}
      footer={
        active && !proposing && !referring ? (
          <View style={styles.composer}>
            <TextField label={isShaykh ? t('community.fatwa.yourAnswer') : t('community.fatwa.yourReply')} value={text} onChangeText={setText} multiline />
            {isShaykh ? <SwitchRow label={t('community.fatwa.markAnswered')} value={answered} onChange={setAnswered} /> : null}
            <Button
              title={t('community.comments.send')}
              loading={sending}
              disabled={!text.trim()}
              onPress={() =>
                run(
                  () => sendFatwaMessage(token, threadId, text.trim(), isShaykh && answered),
                  () => {
                    setText('');
                    setAnswered(false);
                  },
                )
              }
            />
          </View>
        ) : undefined
      }>
      <Card tone="accent" style={styles.gap}>
        <AppText variant="caption" color="textSecondary">
          {isShaykh && thread.question.asker_gender ? t(`community.fatwa.askedBy.${thread.question.asker_gender}`) : t('community.fatwa.question')}
        </AppText>
        <AppText>{thread.question.body}</AppText>
      </Card>

      {isShaykh ? <Button title={t('community.posts.more')} variant="ghost" onPress={() => setOptions(shaykhOptions)} /> : null}

      {proposal && !isShaykh ? (
        <Card style={styles.gap}>
          <AppText weight="semibold">{t('community.fatwa.proposalTitle')}</AppText>
          <AppText variant="caption" color="textSecondary">
            {t('community.fatwa.proposalHint')}
          </AppText>
          <AppText weight="semibold">{proposal.question_text}</AppText>
          <AppText>{proposal.answer_text}</AppText>
          <View style={styles.row}>
            <Button
              title={t('community.fatwa.approve')}
              style={styles.flex}
              loading={sending}
              onPress={() => run(() => decidePublication(token, proposal.id, 'approve'), () => Alert.alert(t('community.fatwa.publishedNow')))}
            />
            <Button title={t('community.fatwa.refuse')} variant="ghost" style={styles.flex} onPress={() => run(() => decidePublication(token, proposal.id, 'refuse'))} />
          </View>
        </Card>
      ) : null}
      {proposal && isShaykh ? <AppText color="textSecondary">{t('community.fatwa.proposalSent')}</AppText> : null}
      {thread.publication?.published_at ? <AppText color="primary">{t('community.fatwa.isPublished')}</AppText> : null}

      {proposing ? (
        <Section title={t('community.fatwa.propose')}>
          <AppText variant="caption" color="textSecondary">
            {t('community.fatwa.proposeHint')}
          </AppText>
          <TextField label={t('community.fatwa.question')} value={proposing.question} onChangeText={(question) => setProposing({ ...proposing, question })} multiline />
          <TextField label={t('community.fatwa.answer')} value={proposing.answer} onChangeText={(answer) => setProposing({ ...proposing, answer })} multiline />
          <Button
            title={t('community.fatwa.sendProposal')}
            loading={sending}
            disabled={!proposing.question.trim() || !proposing.answer.trim()}
            onPress={() =>
              run(
                () => proposePublish(token, threadId, { question_text: proposing.question.trim(), answer_text: proposing.answer.trim() }),
                () => setProposing(null),
              )
            }
          />
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setProposing(null)} />
        </Section>
      ) : null}

      {referring ? (
        <Section title={t('community.fatwa.referTo')}>
          {referring
            .filter((shaykh) => shaykh.id !== thread.shaykh?.id)
            .map((shaykh) => (
              <Row
                key={shaykh.id}
                title={`${shaykh.first_name} ${shaykh.last_name}`}
                subtitle={t('community.fatwa.manhajLine', { manhaj: shaykh.manhaj, marja: shaykh.marja })}
                onPress={() => run(() => referThread(token, threadId, shaykh.id), () => router.back())}
              />
            ))}
          <Button title={t('common.cancel')} variant="ghost" onPress={() => setReferring(null)} />
        </Section>
      ) : null}

      <Section title={t('community.fatwa.conversation')}>
        {thread.messages.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.noMessages')}</AppText> : null}
        {thread.messages.map((message) => {
          const mine = (message.from === 'shaykh') === isShaykh;
          return (
            <Card key={message.id} tone={mine ? 'surface' : 'accent'} style={[styles.message, mine ? styles.mine : styles.theirs]}>
              <AppText variant="caption" color="textSecondary">
                {message.from === 'shaykh' ? t('community.fatwa.shaykh') : t('community.fatwa.asker')}
              </AppText>
              <AppText>{message.body}</AppText>
            </Card>
          );
        })}
      </Section>

      <OptionsSheet options={options} onClose={() => setOptions(null)} />
      <ReportSheet target={reporting ? { type: 'fatwa_question', id: thread.question.id } : null} onClose={() => setReporting(false)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  composer: { gap: Spacing.two },
  gap: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
  message: { gap: Spacing.half, maxWidth: '88%' },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
});
