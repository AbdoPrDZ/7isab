import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PostCard } from '@/components/community/PostCard';
import { ProgramImportFlow } from '@/components/community/ProgramImportFlow';
import { TestamentImportFlow } from '@/components/community/TestamentImportFlow';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCommunityFeed } from '@/lib/community/api';
import { useSession } from '@/lib/session/session-provider';
import type { CommunityPost } from '@/lib/community/types';

export default function CommunityFeedScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { token } = useSession();
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPost, setSelectedPost] = useState<CommunityPost | null>(null);
  const [importFlowType, setImportFlowType] = useState<'testament' | 'program' | null>(null);

  const loadFeed = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCommunityFeed(token || '');
      const postsData = Array.isArray(data) ? data : (data as any)?.posts || [];
      setPosts(postsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load feed');
      console.error('Failed to load community feed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed]),
  );

  const handleImport = (post: CommunityPost) => {
    setSelectedPost(post);
    if (post.type === 'testament') {
      setImportFlowType('testament');
    } else if (post.type === 'program') {
      setImportFlowType('program');
    }
  };

  const handleImportComplete = () => {
    setImportFlowType(null);
    setSelectedPost(null);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.background, paddingTop: insets.top }]}>
      {loading && posts.length === 0 ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : error && posts.length === 0 ? (
        <View style={styles.centerContent}>
          {/* Error state can be enhanced with retry button later */}
        </View>
      ) : (
        <FlatList
          data={posts}
          renderItem={({ item }) => <PostCard post={item} onImport={handleImport} />}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContent}
          scrollIndicatorInsets={{ right: 1 }}
        />
      )}

      {selectedPost && importFlowType === 'testament' && (
        <View style={styles.modalOverlay}>
          <TestamentImportFlow
            post={selectedPost}
            onComplete={handleImportComplete}
            onCancel={handleImportComplete}
          />
        </View>
      )}

      {selectedPost && importFlowType === 'program' && (
        <View style={styles.modalOverlay}>
          <ProgramImportFlow
            post={selectedPost}
            onComplete={handleImportComplete}
            onCancel={handleImportComplete}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  modalOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
});
