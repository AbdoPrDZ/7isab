import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { TimeSpinner } from '@/components/ui/time-spinner';
import { Spacing } from '@/constants/theme';
import { ApiError } from '@/lib/api/client';
import { createPost } from '@/lib/community/api';
import { toUtcIso } from '@/lib/community/events';
import type { Audience, NewPost } from '@/lib/community/types';
import { addDays, daysBetween, today } from '@/lib/dates';
import { useTasks } from '@/lib/ledger/hooks';
import { usePrograms } from '@/lib/programs/programs';
import { useSession } from '@/lib/session/session-provider';
import { useTestamentContent, useTestaments } from '@/lib/testaments/testaments';

type Kind = NewPost['type'];

const KINDS: Kind[] = ['text', 'ayah', 'hadith', 'event', 'testament', 'program'];

/** A program without an end day is shared with this length. */
const DEFAULT_PROGRAM_DAYS = 30;

/**
 * Writing a post in a group or page. A shared Testament or program is copied
 * from the user's own data only when they pick it here: a program goes as a
 * template (name, goal, length, tasks), never their progress or relapses.
 */
export default function ComposeScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const params = useLocalSearchParams<{ spaceId: string; name?: string; openPage?: string }>();
  const spaceId = Number(params.spaceId);
  // The audience only matters on a page open to everyone.
  const canChooseAudience = params.openPage === '1';

  const testaments = useTestaments();
  const testamentContent = useTestamentContent();
  const programs = usePrograms().filter((program) => !program.archived);
  const tasks = useTasks();

  const [kind, setKind] = useState<Kind>('text');
  const [body, setBody] = useState('');
  const [audience, setAudience] = useState<Audience>('everyone');
  const [surah, setSurah] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [hadith, setHadith] = useState({ text: '', book: '', number: '', grade: '' });
  const [testamentId, setTestamentId] = useState<string | null>(null);
  const [programId, setProgramId] = useState<string | null>(null);
  const [event, setEvent] = useState({ title: '', day: addDays(today(), 1), hour: 20, minute: 0, place: '', link: '', details: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  const build = (): NewPost | null => {
    const shared = { body: body.trim() || undefined, audience };
    switch (kind) {
      case 'text':
        return body.trim() ? { type: 'text', body: body.trim(), audience } : null;
      case 'ayah': {
        const start = Number(from);
        if (!Number(surah) || !start) return null;
        return { type: 'ayah', ...shared, payload: { surah: Number(surah), from: start, to: Number(to) || start } };
      }
      case 'hadith':
        if (!hadith.text.trim() || !hadith.book.trim() || !hadith.number.trim()) return null;
        return {
          type: 'hadith',
          ...shared,
          payload: { text: hadith.text.trim(), book: hadith.book.trim(), number: hadith.number.trim(), grade: hadith.grade.trim() || undefined },
        };
      case 'testament': {
        const testament = testaments.find((item) => item.id === testamentId);
        if (!testament) return null;
        const content = testamentContent(testament);
        return { type: 'testament', ...shared, payload: { category: testament.category, text: content.text, source: content.source ?? undefined } };
      }
      case 'event': {
        const startsAt = toUtcIso(event.day, `${event.hour}:${String(event.minute).padStart(2, '0')}`);
        if (!event.title.trim() || !startsAt) return null;
        return {
          type: 'event',
          ...shared,
          payload: {
            title: event.title.trim(),
            starts_at: startsAt,
            place: event.place.trim() || null,
            link: event.link.trim() || null,
            details: event.details.trim() || null,
          },
        };
      }
      case 'program': {
        const program = programs.find((item) => item.id === programId);
        if (!program) return null;
        const programTasks = tasks.filter((task) => task.programId === program.id && !task.archived);
        if (!programTasks.length) return null;
        return {
          type: 'program',
          ...shared,
          payload: {
            name: program.name,
            category: program.category,
            custom_category: program.customCategory,
            goal: program.goal || program.name,
            length: program.endDate ? daysBetween(program.startDate, program.endDate).length : DEFAULT_PROGRAM_DAYS,
            tasks: programTasks.map((task) => ({ name: task.title, type: task.repeat.kind, reward: task.reward })),
          },
        };
      }
    }
  };

  const send = async () => {
    const post = build();
    if (!post) {
      setErrors({ form: kind === 'program' && programId ? t('community.compose.programNoTasks') : t('community.compose.missing') });
      return;
    }
    setSending(true);
    setErrors({});
    try {
      const { post: created } = await createPost(token, spaceId, post);
      if (created.status === 'pending') Alert.alert(t('community.compose.pendingTitle'), t('community.compose.pendingHint'));
      router.back();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.errors).length) setErrors({ form: Object.values(error.errors)[0] });
      else if (error instanceof ApiError && error.status === 403) setErrors({ form: t('community.compose.closed') });
      else setErrors({ form: t('errors.generic') });
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen
      back
      title={t('community.compose.title')}
      subtitle={params.name}
      footer={<Button title={t('community.compose.publish')} loading={sending} onPress={send} />}>
      <Chips options={KINDS.map((value) => ({ value, label: t(`community.posts.types.${value}`) }))} value={kind} onChange={setKind} />

      {errors.form ? (
        <Card tone="danger">
          <AppText color="danger">{errors.form}</AppText>
        </Card>
      ) : null}

      {kind === 'ayah' ? (
        <Section title={t('community.compose.ayahTitle')}>
          <AppText variant="caption" color="textSecondary">
            {t('community.compose.ayahHint')}
          </AppText>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t('community.compose.surah')} value={surah} onChangeText={setSurah} keyboardType="number-pad" />
            </View>
            <View style={styles.flex}>
              <TextField label={t('community.compose.from')} value={from} onChangeText={setFrom} keyboardType="number-pad" />
            </View>
            <View style={styles.flex}>
              <TextField label={t('community.compose.to')} value={to} onChangeText={setTo} keyboardType="number-pad" />
            </View>
          </View>
        </Section>
      ) : null}

      {kind === 'hadith' ? (
        <Section title={t('community.compose.hadithTitle')}>
          <TextField label={t('community.compose.hadithText')} value={hadith.text} onChangeText={(text) => setHadith({ ...hadith, text })} multiline />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label={t('community.compose.book')} value={hadith.book} onChangeText={(book) => setHadith({ ...hadith, book })} />
            </View>
            <View style={styles.flex}>
              <TextField label={t('community.compose.number')} value={hadith.number} onChangeText={(number) => setHadith({ ...hadith, number })} />
            </View>
          </View>
          <TextField label={t('community.compose.grade')} value={hadith.grade} onChangeText={(grade) => setHadith({ ...hadith, grade })} />
        </Section>
      ) : null}

      {kind === 'event' ? (
        <Section title={t('community.events.title')}>
          <TextField label={t('community.events.name')} value={event.title} onChangeText={(title) => setEvent({ ...event, title })} />
          <TextField
            label={t('community.events.day')}
            value={event.day}
            onChangeText={(day) => setEvent({ ...event, day })}
            placeholder="2026-12-31"
            keyboardType="numbers-and-punctuation"
          />
          <AppText variant="label" color="textSecondary">
            {t('community.events.time')}
          </AppText>
          <TimeSpinner hour={event.hour} minute={event.minute} onChange={(hour, minute) => setEvent({ ...event, hour, minute })} />
          <TextField label={t('community.events.place')} value={event.place} onChangeText={(place) => setEvent({ ...event, place })} />
          <TextField
            label={t('community.events.link')}
            value={event.link}
            onChangeText={(link) => setEvent({ ...event, link })}
            autoCapitalize="none"
            keyboardType="url"
            placeholder="https://"
          />
          <TextField label={t('community.events.details')} value={event.details} onChangeText={(details) => setEvent({ ...event, details })} multiline />
          <AppText variant="caption" color="textSecondary">
            {t('community.events.timeZoneHint')}
          </AppText>
        </Section>
      ) : null}

      {kind === 'testament' ? (
        <Section title={t('community.compose.pickTestament')}>
          {testaments.length === 0 ? <AppText color="textSecondary">{t('community.compose.noTestaments')}</AppText> : null}
          {testaments.map((testament) => (
            <Row
              key={testament.id}
              title={testamentContent(testament).text}
              subtitle={t(`testaments.categories.${testament.category}`)}
              value={testament.id === testamentId ? '✓' : undefined}
              valueColor="primary"
              onPress={() => setTestamentId(testament.id)}
            />
          ))}
        </Section>
      ) : null}

      {kind === 'program' ? (
        <Section title={t('community.compose.pickProgram')}>
          <AppText variant="caption" color="textSecondary">
            {t('community.compose.programHint')}
          </AppText>
          {programs.length === 0 ? <AppText color="textSecondary">{t('community.compose.noPrograms')}</AppText> : null}
          {programs.map((program) => (
            <Row
              key={program.id}
              title={program.name}
              subtitle={program.goal}
              value={program.id === programId ? '✓' : undefined}
              valueColor="primary"
              onPress={() => setProgramId(program.id)}
            />
          ))}
        </Section>
      ) : null}

      <TextField
        label={kind === 'text' ? t('community.compose.text') : t('community.compose.note')}
        value={body}
        onChangeText={setBody}
        multiline
      />

      {canChooseAudience ? (
        <Section title={t('community.compose.audience')}>
          <Chips
            options={[
              { value: 'everyone' as Audience, label: t('community.compose.audiences.everyone') },
              { value: 'own_gender' as Audience, label: t('community.compose.audiences.own_gender') },
            ]}
            value={audience}
            onChange={setAudience}
          />
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
