import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { ImportSheet } from '@/components/community/import-sheet';
import { PostCard } from '@/components/community/post-card';
import { OptionsSheet, ReportSheet, type SheetOption } from '@/components/community/sheets';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import {
  createComment,
  deleteComment,
  deletePost,
  getComments,
  getPost,
  hidePerson,
  setPostSaved,
  updateComment,
  updatePost,
} from '@/lib/community/api';
import type { CommunityComment, CommunityPost, ReportTarget } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** Deepest reply indent; deeper replies stay at this level. */
const MAX_DEPTH = 4;

type Draft = { mode: 'comment' } | { mode: 'reply'; to: CommunityComment } | { mode: 'editComment'; comment: CommunityComment } | { mode: 'editPost' };

/** A post with the comments of the viewer's own gender, as a reply tree. */
export default function PostScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const postId = Number(id);
  const [post, setPost] = useState<CommunityPost | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [missing, setMissing] = useState(false);
  const [draft, setDraft] = useState<Draft>({ mode: 'comment' });
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [options, setOptions] = useState<SheetOption[] | null>(null);
  const [reporting, setReporting] = useState<{ type: ReportTarget; id: number } | null>(null);
  const [importing, setImporting] = useState<CommunityPost | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    Promise.all([getPost(token, postId), getComments(token, postId)])
      .then(([loaded, list]) => {
        if (cancelled) return;
        setPost(loaded.post);
        setComments(list.comments);
      })
      .catch((error) => !cancelled && error instanceof ApiError && error.status === 404 && setMissing(true));
    return () => {
      cancelled = true;
    };
  }, [token, postId]);

  useFocusEffect(load);

  const tree = useMemo(() => flatten(comments), [comments]);

  const reset = () => {
    setDraft({ mode: 'comment' });
    setText('');
  };

  const send = async () => {
    const body = text.trim();
    if (!body && draft.mode !== 'editPost') return;
    setSending(true);
    try {
      if (draft.mode === 'editPost') await updatePost(token, postId, body);
      else if (draft.mode === 'editComment') await updateComment(token, draft.comment.id, body);
      else await createComment(token, postId, { body, parent_id: draft.mode === 'reply' ? draft.to.id : null });
      reset();
      load();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSending(false);
    }
  };

  const confirm = (title: string, action: () => Promise<unknown>, after: () => void) =>
    Alert.alert(title, undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await action();
            after();
          } catch {
            Alert.alert(t('errors.generic'));
          }
        },
      },
    ]);

  const hideAuthor = (kind: 'blocks' | 'mutes', authorId: number) =>
    Alert.alert(t(`community.posts.${kind === 'blocks' ? 'blockTitle' : 'muteTitle'}`), t(`community.posts.${kind === 'blocks' ? 'blockHint' : 'muteHint'}`), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.confirm'),
        onPress: async () => {
          await hidePerson(token, kind, authorId).catch(() => undefined);
          router.back();
        },
      },
    ]);

  const postOptions = (): SheetOption[] => {
    if (!post) return [];
    if (post.mine) {
      return [
        ...(post.type === 'text' || post.body
          ? [{ label: t('community.posts.edit'), onPress: () => (setDraft({ mode: 'editPost' }), setText(post.body ?? '')) }]
          : []),
        {
          label: t('community.posts.delete'),
          destructive: true,
          onPress: () => confirm(t('community.posts.deleteTitle'), () => deletePost(token, post.id), () => router.back()),
        },
      ];
    }
    return [
      { label: t('community.report.action'), onPress: () => setReporting({ type: 'post', id: post.id }) },
      ...(post.author
        ? [
            { label: t('community.posts.mute'), onPress: () => hideAuthor('mutes', post.author!.id) },
            { label: t('community.posts.block'), destructive: true, onPress: () => hideAuthor('blocks', post.author!.id) },
          ]
        : []),
    ];
  };

  const commentOptions = (comment: CommunityComment): SheetOption[] =>
    comment.mine
      ? [
          { label: t('community.posts.edit'), onPress: () => (setDraft({ mode: 'editComment', comment }), setText(comment.body ?? '')) },
          {
            label: t('community.posts.delete'),
            destructive: true,
            onPress: () => confirm(t('community.comments.deleteTitle'), () => deleteComment(token, comment.id), load),
          },
        ]
      : [
          { label: t('community.report.action'), onPress: () => setReporting({ type: 'comment', id: comment.id }) },
          ...(comment.author ? [{ label: t('community.posts.mute'), onPress: () => hideAuthor('mutes', comment.author!.id) }] : []),
        ];

  if (!post) {
    return (
      <Screen back title={t('community.posts.title')}>
        {missing ? (
          <AppText color="textSecondary" align="center" style={styles.center}>
            {t('community.posts.missing')}
          </AppText>
        ) : (
          <ActivityIndicator size="large" color={theme.primary} style={styles.center} />
        )}
      </Screen>
    );
  }

  const placeholder = {
    comment: t('community.comments.placeholder'),
    reply: t('community.comments.replyPlaceholder'),
    editComment: t('community.comments.editPlaceholder'),
    editPost: t('community.posts.editPlaceholder'),
  }[draft.mode];

  return (
    <Screen
      back
      title={post.space?.name ?? t('community.posts.title')}
      footer={
        post.status === 'published' || draft.mode === 'editPost' ? (
          <View style={styles.composer}>
            {draft.mode !== 'comment' ? (
              <View style={styles.row}>
                <AppText variant="caption" color="textSecondary" style={styles.flex}>
                  {draft.mode === 'reply'
                    ? t('community.comments.replyingTo', { name: draft.to.author?.first_name ?? '' })
                    : t('community.comments.editing')}
                </AppText>
                <Button title={t('common.cancel')} variant="ghost" onPress={reset} />
              </View>
            ) : null}
            <TextField label={placeholder} value={text} onChangeText={setText} multiline />
            <Button title={t('community.comments.send')} loading={sending} disabled={!text.trim() && draft.mode !== 'editPost'} onPress={send} />
          </View>
        ) : undefined
      }>
      <PostCard post={post} openable={false} onImport={setImporting} />

      <View style={styles.row}>
        {post.status === 'published' ? (
          <Button
            title={post.saved ? t('community.posts.unsave') : t('community.posts.save')}
            variant="secondary"
            style={styles.flex}
            onPress={async () => {
              await setPostSaved(token, post.id, !post.saved).catch(() => undefined);
              load();
            }}
          />
        ) : null}
        <Button title={t('community.posts.more')} variant="ghost" style={styles.flex} onPress={() => setOptions(postOptions())} />
      </View>

      <Section title={t('community.comments.title')}>
        <AppText variant="caption" color="textSecondary">
          {t('community.comments.separated')}
        </AppText>
        {tree.length === 0 ? <AppText color="textSecondary">{t('community.comments.none')}</AppText> : null}
        {tree.map(({ comment, depth }) => (
          <Card key={comment.id} style={[styles.comment, { marginStart: Math.min(depth, MAX_DEPTH) * Spacing.four }]}>
            <AppText variant="caption" weight="semibold" color={comment.deleted ? 'textSecondary' : 'text'}>
              {comment.author ? `${comment.author.first_name} ${comment.author.last_name}` : t('community.comments.deleted')}
            </AppText>
            {comment.body ? <AppText>{comment.body}</AppText> : null}
            {!comment.deleted ? (
              <View style={styles.row}>
                {comment.edited_at ? (
                  <AppText variant="caption" color="textSecondary" style={styles.flex}>
                    {t('community.posts.edited')}
                  </AppText>
                ) : (
                  <View style={styles.flex} />
                )}
                <Link label={t('community.comments.reply')} onPress={() => (setDraft({ mode: 'reply', to: comment }), setText(''))} />
                <Link label={t('community.posts.more')} onPress={() => setOptions(commentOptions(comment))} />
              </View>
            ) : null}
          </Card>
        ))}
      </Section>

      <OptionsSheet options={options} onClose={() => setOptions(null)} />
      <ReportSheet target={reporting} onClose={() => setReporting(null)} />
      <ImportSheet
        post={importing}
        onClose={() => {
          setImporting(null);
          load();
        }}
      />
    </Screen>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <AppText variant="caption" weight="semibold" color="primary">
        {label}
      </AppText>
    </Pressable>
  );
}

/** Depth-first order with each comment's depth, so replies sit under their parent. */
function flatten(comments: CommunityComment[]): { comment: CommunityComment; depth: number }[] {
  const children = new Map<number | null, CommunityComment[]>();
  const ids = new Set(comments.map((comment) => comment.id));
  for (const comment of comments) {
    // A reply whose parent isn't in the list is shown at the top level.
    const parent = comment.parent_id !== null && ids.has(comment.parent_id) ? comment.parent_id : null;
    children.set(parent, [...(children.get(parent) ?? []), comment]);
  }
  const result: { comment: CommunityComment; depth: number }[] = [];
  const visit = (parent: number | null, depth: number) => {
    for (const comment of children.get(parent) ?? []) {
      result.push({ comment, depth });
      visit(comment.id, depth + 1);
    }
  };
  visit(null, 0);
  return result;
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six },
  composer: { gap: Spacing.two },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  flex: { flex: 1 },
  comment: { gap: Spacing.one },
});
