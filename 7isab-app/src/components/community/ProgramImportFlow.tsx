import { StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';

import { Colors } from '@/constants/theme';
import { CommunityPost, ProgramPayload } from '@/lib/community/types';
import { saveProgram } from '@/lib/programs/programs';
import { saveTask } from '@/lib/ledger/tasks';
import { Button } from '@/components/ui/button';

interface ProgramImportFlowProps {
  post: CommunityPost;
  onComplete?: () => void;
  onCancel?: () => void;
}

export function ProgramImportFlow({ post, onComplete, onCancel }: ProgramImportFlowProps) {
  const payload = post.payload as ProgramPayload | null;
  const [startDate, setStartDate] = useState(new Date());
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!payload) return;

    setLoading(true);
    try {
      const programId = `community:${post.id}`;
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = new Date(startDate.getTime() + payload.length * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];

      await saveProgram({
        id: programId,
        name: payload.name,
        category: payload.category as 'improving' | 'healing' | 'custom',
        customCategory: payload.custom_category,
        goal: payload.goal,
        startDate: startDateStr,
        endDate: endDateStr,
        archived: false,
      });

      // Create tasks for this program
      for (const taskData of payload.tasks) {
        const taskId = `${programId}:${taskData.name.toLowerCase().replace(/\s+/g, '-')}`;

        await saveTask({
          id: taskId,
          kind: 'custom',
          title: taskData.name,
          target: { amount: 1, unit: 'count' },
          reward: taskData.reward || 1,
          penalty: 1,
          repeat: { kind: 'daily' },
          startDate: startDateStr,
          programId,
        });
      }

      onComplete?.();
    } catch (error) {
      console.error('Program import failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const endDate = payload
    ? new Date(startDate.getTime() + payload.length * 24 * 60 * 60 * 1000)
    : null;

  if (!payload) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Import Program</Text>

      <View style={styles.preview}>
        <Text style={styles.name}>{payload.name}</Text>
        <Text style={styles.goal}>{payload.goal}</Text>
        <Text style={styles.meta}>
          {payload.length} days • {payload.tasks.length} tasks
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Start Date</Text>
        <View style={styles.dateDisplay}>
          <Text style={styles.dateText}>{startDate.toLocaleDateString()}</Text>
          <Text style={styles.dateEndText}>
            Ends: {endDate?.toLocaleDateString()}
          </Text>
        </View>
        <Button
          onPress={() => setStartDate(new Date())}
          title="Start Today"
          variant="secondary"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tasks</Text>
        <View style={styles.tasksList}>
          {payload.tasks.map((task, idx) => (
            <View key={idx} style={styles.taskItem}>
              <Text style={styles.taskName}>{task.name}</Text>
              <Text style={styles.taskType}>{task.type}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.buttonGroup}>
        <Button onPress={handleImport} title="Import Program" loading={loading} />
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
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 4,
  },
  goal: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 8,
  },
  meta: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: 8,
  },
  dateDisplay: {
    backgroundColor: Colors.light.background,
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: Colors.light.text,
    marginBottom: 4,
  },
  dateEndText: {
    fontSize: 12,
    color: Colors.light.textSecondary,
  },
  tasksList: {
    gap: 8,
  },
  taskItem: {
    backgroundColor: Colors.light.background,
    padding: 8,
    borderRadius: 6,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  taskName: {
    fontSize: 13,
    color: Colors.light.text,
    flex: 1,
  },
  taskType: {
    fontSize: 11,
    color: Colors.light.textSecondary,
    backgroundColor: Colors.light.surface,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
  },
  buttonGroup: {
    marginBottom: 8,
  },
  cancelButton: {
    marginTop: 8,
  },
});
