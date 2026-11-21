import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/layout';
import { Spacing } from '@/constants/theme';
import { useLedgerLabels } from '@/lib/ledger/hooks';
import type { CommunityPost, ProgramPayload, TestamentPayload } from '@/lib/community/types';

type PostCardProps = {
  post: CommunityPost;
  onImport?: (post: CommunityPost) => void;
};

/** Shown in the preview; the import sheet lists every task. */
const PREVIEW_TASKS = 3;

export function PostCard({ post, onImport }: PostCardProps) {
  const { t } = useTranslation();
  const { format } = useLedgerLabels();
  const author = post.author ? `${post.author.first_name} ${post.author.last_name}` : '';
  const importable = (post.type === 'testament' || post.type === 'program') && post.payload;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <AppText variant="label" weight="semibold" style={styles.flex}>
          {author}
        </AppText>
        {post.type === 'testament' ? <Tag label={t('community.testament')} /> : null}
        {post.type === 'program' ? <Tag label={t('community.program')} /> : null}
      </View>

      <AppText>{post.body}</AppText>

      {post.type === 'testament' && post.payload ? <TestamentPreview payload={post.payload as TestamentPayload} /> : null}
      {post.type === 'program' && post.payload ? <ProgramPreview payload={post.payload as ProgramPayload} /> : null}

      {post.imports_count ? (
        <AppText variant="caption" color="textSecondary">
          {t('community.imports', { count: format.number(post.imports_count) })}
        </AppText>
      ) : null}

      {importable && onImport ? <Button title={t('community.import')} variant="secondary" onPress={() => onImport(post)} /> : null}
    </Card>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <AppText variant="caption" weight="semibold" color="primary">
      {label}
    </AppText>
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
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  flex: { flex: 1 },
  preview: { gap: Spacing.one },
});
