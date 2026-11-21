import { StyleSheet, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';
import { CommunityPost, ProgramPayload, TestamentPayload } from '@/lib/community/types';

interface PostCardProps {
  post: CommunityPost;
  onImport?: (post: CommunityPost) => void;
}

export function PostCard({ post, onImport }: PostCardProps) {
  if (post.type === 'testament') {
    return <TestamentPostCard post={post} onImport={onImport} />;
  }

  if (post.type === 'program') {
    return <ProgramPostCard post={post} onImport={onImport} />;
  }

  return <TextPostCard post={post} onImport={onImport} />;
}

function TextPostCard({ post, onImport }: PostCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>
          {post.author?.first_name} {post.author?.last_name}
        </Text>
      </View>
      <Text style={styles.body}>{post.body}</Text>
    </View>
  );
}

function TestamentPostCard({ post, onImport }: PostCardProps) {
  const payload = post.payload as TestamentPayload | null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>
          {post.author?.first_name} {post.author?.last_name}
        </Text>
        <Text style={styles.category}>{payload?.category || 'Testament'}</Text>
      </View>
      <Text style={styles.body}>{post.body}</Text>
      {payload?.text && <Text style={styles.testament}>{payload.text}</Text>}
      {payload?.source && <Text style={styles.source}>— {payload.source}</Text>}
    </View>
  );
}

function ProgramPostCard({ post, onImport }: PostCardProps) {
  const payload = post.payload as ProgramPayload | null;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.author}>
          {post.author?.first_name} {post.author?.last_name}
        </Text>
        <Text style={styles.category}>{payload?.name || 'Program'}</Text>
      </View>
      <Text style={styles.body}>{post.body}</Text>
      {payload?.goal && <Text style={styles.goal}>Goal: {payload.goal}</Text>}
      {payload?.length && <Text style={styles.length}>{payload.length} days</Text>}
      {payload?.tasks && (
        <View style={styles.tasksList}>
          {payload.tasks.slice(0, 3).map((task, idx) => (
            <Text key={idx} style={styles.taskItem}>
              • {task.name}
            </Text>
          ))}
          {payload.tasks.length > 3 && (
            <Text style={styles.moreTasksText}>
              +{payload.tasks.length - 3} more tasks
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.light.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  author: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
  },
  category: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.background,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  body: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 8,
  },
  testament: {
    fontSize: 13,
    color: Colors.light.text,
    fontStyle: 'italic',
    marginBottom: 4,
  },
  source: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  goal: {
    fontSize: 13,
    color: Colors.light.text,
    marginBottom: 4,
  },
  length: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    marginBottom: 8,
  },
  tasksList: {
    marginTop: 8,
    paddingLeft: 8,
  },
  taskItem: {
    fontSize: 12,
    color: Colors.light.text,
    marginBottom: 2,
  },
  moreTasksText: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    marginTop: 2,
  },
});
