import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Colors } from '@/constants/theme';
import { CommunityPost, TestamentPayload } from '@/lib/community/types';
import { saveTestament } from '@/lib/testaments/testaments';
import { Button } from '@/components/ui/button';

interface TestamentImportFlowProps {
  post: CommunityPost;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function TestamentImportFlow({ post, onComplete, onCancel }: TestamentImportFlowProps) {
  const payload = post.payload as TestamentPayload | null;
  const [enabled, setEnabled] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!payload) return;

    setLoading(true);
    try {
      const id = `community:${post.id}`;

      await saveTestament({
        id,
        category: payload.category,
        text: payload.text,
        source: payload.source,
        enabled,
      });

      onComplete?.();
    } catch (error) {
      console.error('Testament import failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!payload) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Testament</Text>

      <View style={styles.preview}>
        <Text style={styles.category}>{payload.category}</Text>
        <Text style={styles.text}>{payload.text}</Text>
        {payload.source && <Text style={styles.source}>— {payload.source}</Text>}
      </View>

      <View style={styles.toggleContainer}>
        <Text style={styles.label}>Enable this testament</Text>
        <View style={[styles.toggle, enabled ? styles.toggleOn : styles.toggleOff]}>
          <Text style={styles.toggleText}>{enabled ? 'On' : 'Off'}</Text>
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <Button
          onPress={() => setEnabled(!enabled)}
          title={enabled ? 'Disable' : 'Enable'}
          variant="secondary"
        />
        <Button onPress={handleImport} title="Import" loading={loading} />
      </View>

      {onCancel && (
        <Button
          onPress={onCancel}
          title="Cancel"
          variant="secondary"
          style={styles.cancelButton}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: Colors.light.surface,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 16,
  },
  preview: {
    backgroundColor: Colors.light.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: Colors.light.primary,
  },
  category: {
    fontSize: 12,
    color: Colors.light.textSecondary,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
    color: Colors.light.text,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  source: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  toggleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.light.border,
  },
  label: {
    fontSize: 14,
    color: Colors.light.text,
  },
  toggle: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  toggleOn: {
    backgroundColor: Colors.light.primary,
  },
  toggleOff: {
    backgroundColor: Colors.light.textSecondary,
  },
  toggleText: {
    color: Colors.light.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  cancelButton: {
    marginTop: 8,
  },
});
