import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips, Section } from '@/components/ui/layout';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { importProgram, importTestament } from '@/lib/community/imports';
import type { CommunityPost, ProgramPayload, TestamentPayload } from '@/lib/community/types';
import { addDays, today } from '@/lib/dates';
import { useSession } from '@/lib/session/session-provider';

import { ProgramPreview, TestamentPreview } from './post-card';

type ImportSheetProps = {
  /** The Testament or program post to import; null hides the sheet. */
  post: CommunityPost | null;
  onClose: () => void;
};

/** Confirms an import into the user's own (encrypted) data. */
export function ImportSheet({ post, onClose }: ImportSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={post !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ScrollView contentContainerStyle={styles.content}>
            {post ? <SheetBody key={post.id} post={post} onClose={onClose} /> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SheetBody({ post, onClose }: { post: CommunityPost; onClose: () => void }) {
  const { t } = useTranslation();
  const { token } = useSession();
  const [enabled, setEnabled] = useState(true);
  const [startDate, setStartDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const isProgram = post.type === 'program';

  const save = async () => {
    setSaving(true);
    try {
      if (isProgram) {
        await importProgram(token, post, startDate);
      } else {
        await importTestament(token, post, enabled);
      }
      onClose();
      Alert.alert(t('community.imported'));
    } catch {
      Alert.alert(t('community.importFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <AppText variant="heading" align="center">
        {isProgram ? t('community.importProgram') : t('community.importTestament')}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {isProgram ? t('community.importProgramHint') : t('community.importTestamentHint')}
      </AppText>

      {isProgram ? (
        <>
          <ProgramPreview payload={post.payload as ProgramPayload} allTasks />
          <Section title={t('programs.start')}>
            <Chips
              options={[
                { value: today(), label: t('programs.startToday') },
                { value: addDays(today(), 1), label: t('programs.startTomorrow') },
              ]}
              value={startDate}
              onChange={setStartDate}
            />
          </Section>
        </>
      ) : (
        <>
          <TestamentPreview payload={post.payload as TestamentPayload} />
          <SwitchRow label={t('community.remindMe')} value={enabled} onChange={setEnabled} />
        </>
      )}

      <Button title={t('community.import')} loading={saving} onPress={save} />
      <Button title={t('common.cancel')} variant="ghost" disabled={saving} onPress={onClose} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: Radius.large,
    borderTopRightRadius: Radius.large,
    borderWidth: 1,
    padding: Spacing.four,
  },
  content: { gap: Spacing.three },
});
