import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { QURAN_FONT } from '@/components/quran/mushaf-page';
import { AppText } from '@/components/ui/app-text';
import { ReminderSheet } from '@/components/community/sheets';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { eventStart, isPast } from '@/lib/community/events';
import type { AyahPayload, CommunityPost, EventPayload, HadithPayload, ProgramPayload, TestamentPayload } from '@/lib/community/types';
import { useLedgerLabels } from '@/lib/ledger/hooks';

type PostCardProps = {
  post: CommunityPost;
  onImport?: (post: CommunityPost) => void;
  /** Shows which space the post is from (the feed). */
  showSpace?: boolean;
  /** Opens the post with its comments; off on the post screen itself. */
  openable?: boolean;
};

/** Shown in the preview; the import sheet lists every task. */
const PREVIEW_TASKS = 3;

export function PostCard({ post, onImport, showSpace = false, openable = true }: PostCardProps) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const importable = (post.type === 'testament' || post.type === 'program') && post.payload && !post.deleted_by_author;
  const open = () => router.push({ pathname: '/community/post/[id]', params: { id: String(post.id) } });

  const content = (
    <>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="label" weight="semibold" color={post.deleted_by_author ? 'textSecondary' : 'text'}>
            {post.author ? `${post.author.first_name} ${post.author.last_name}` : t('community.posts.deletedByAuthor')}
          </AppText>
          {showSpace && post.space ? (
            <AppText variant="caption" color="textSecondary">
              {post.space.name}
            </AppText>
          ) : null}
        </View>
        <Tag label={t(`community.posts.types.${post.type}`)} />
      </View>

      {post.status === 'pending' ? (
        <AppText variant="caption" color="accent">
          {t('community.posts.pending')}
        </AppText>
      ) : null}

      {post.body ? <AppText>{post.body}</AppText> : null}

      {!post.deleted_by_author && post.payload ? <PayloadPreview post={post} /> : null}

      <View style={styles.footer}>
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          {[
            post.comments_count ? t('community.posts.commentsCount', { count: format.number(post.comments_count) }) : null,
            post.imports_count ? t('community.imports', { count: format.number(post.imports_count) }) : null,
            post.edited_at ? t('community.posts.edited') : null,
            post.saved ? t('community.posts.saved') : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>

      {importable && onImport ? <Button title={t('community.import')} variant="secondary" onPress={() => onImport(post)} /> : null}
    </>
  );

  return (
    <Card style={styles.card}>
      {openable ? (
        <Pressable accessibilityRole="button" onPress={open} style={styles.card}>
          {content}
        </Pressable>
      ) : (
        content
      )}
    </Card>
  );
}

function PayloadPreview({ post }: { post: CommunityPost }) {
  switch (post.type) {
    case 'ayah':
      return <AyahPreview payload={post.payload as AyahPayload} />;
    case 'hadith':
      return <HadithPreview payload={post.payload as HadithPayload} />;
    case 'testament':
      return <TestamentPreview payload={post.payload as TestamentPayload} />;
    case 'program':
      return <ProgramPreview payload={post.payload as ProgramPayload} />;
    case 'event':
      return <EventPreview payload={post.payload as EventPayload} />;
    default:
      return null;
  }
}

function Tag({ label }: { label: string }) {
  return (
    <AppText variant="caption" weight="semibold" color="primary">
      {label}
    </AppText>
  );
}

/** Quran text: the Quran font, always right-to-left, with its reference. */
export function AyahPreview({ payload }: { payload: AyahPayload }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { format } = useLedgerLabels();
  const range = payload.from === payload.to ? format.number(payload.from) : `${format.number(payload.from)}-${format.number(payload.to)}`;

  return (
    <Card tone="accent" style={styles.preview}>
      <AppText style={[styles.ayah, { fontFamily: QURAN_FONT, color: theme.text }]}>
        {payload.ayat.map((ayah) => `${ayah.text} ۝${format.number(ayah.number)}`).join(' ')}
      </AppText>
      <AppText variant="caption" color="textSecondary">
        {t('community.posts.ayahReference', { surah: payload.surah_name, range })}
      </AppText>
    </Card>
  );
}

/** An event or lesson in the phone's time zone, with a private reminder. */
export function EventPreview({ payload }: { payload: EventPayload }) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const [reminding, setReminding] = useState(false);
  const start = eventStart(payload);
  const end = payload.ends_at ? eventStart({ ...payload, starts_at: payload.ends_at }) : null;
  const past = isPast(payload);
  const when = `${format.day(start.day, 'long')} · ${start.time}${end ? ` - ${end.day === start.day ? end.time : `${format.day(end.day)} ${end.time}`}` : ''}`;

  return (
    <Card tone="accent" style={styles.preview}>
      <AppText weight="semibold">{payload.title}</AppText>
      <AppText variant="caption" color={past ? 'textSecondary' : 'primary'} weight="semibold">
        {past ? `${t('community.events.past')} · ${when}` : when}
      </AppText>
      {payload.place ? <AppText variant="caption">{t('community.events.placeLine', { place: payload.place })}</AppText> : null}
      {payload.link ? (
        <AppText variant="caption" color="primary" selectable>
          {payload.link}
        </AppText>
      ) : null}
      {payload.details ? <AppText>{payload.details}</AppText> : null}
      {!past ? <Button title={t('community.events.remindMe')} variant="secondary" onPress={() => setReminding(true)} /> : null}
      <ReminderSheet event={reminding ? payload : null} onClose={() => setReminding(false)} />
    </Card>
  );
}

export function HadithPreview({ payload }: { payload: HadithPayload }) {
  const { t } = useTranslation();

  return (
    <Card tone="accent" style={styles.preview}>
      <AppText>{payload.text}</AppText>
      <AppText variant="caption" color="textSecondary">
        {t('community.posts.hadithSource', { book: payload.book, number: payload.number })}
        {payload.grade ? ` · ${payload.grade}` : ''}
      </AppText>
    </Card>
  );
}

export function TestamentPreview({ payload }: { payload: TestamentPayload }) {
  const { t } = useTranslation();

  return (
    <Card tone="accent" style={styles.preview}>
      <AppText variant="caption" color="textSecondary">
        {t(`testaments.categories.${payload.category}`)}
      </AppText>
      <AppText>{payload.text}</AppText>
      {payload.source ? (
        <AppText variant="caption" color="textSecondary">
          {payload.source}
        </AppText>
      ) : null}
    </Card>
  );
}

export function ProgramPreview({ payload, allTasks = false }: { payload: ProgramPayload; allTasks?: boolean }) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const tasks = allTasks ? payload.tasks : payload.tasks.slice(0, PREVIEW_TASKS);
  const hidden = payload.tasks.length - tasks.length;
  const category =
    payload.category === 'custom' && payload.custom_category ? payload.custom_category : t(`programs.categories.${payload.category}`);

  return (
    <Card tone="accent" style={styles.preview}>
      <AppText weight="semibold">{payload.name}</AppText>
      <AppText variant="caption" color="textSecondary">
        {category} · {t('programs.days', { count: payload.length, days: format.number(payload.length) })}
      </AppText>
      {payload.goal ? <AppText>{payload.goal}</AppText> : null}
      <AppText variant="label" weight="semibold">
        {t('community.tasks')}
      </AppText>
      {tasks.map((task, index) => (
        <AppText key={index} variant="caption">
          {'•'} {task.name}
        </AppText>
      ))}
      {hidden > 0 ? (
        <AppText variant="caption" color="textSecondary">
          {t('community.moreTasks', { count: format.number(hidden) })}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  footer: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  preview: { gap: Spacing.one },
  ayah: { fontSize: 20, lineHeight: 40, writingDirection: 'rtl', textAlign: 'right' },
});
