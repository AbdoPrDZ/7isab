import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Chips, Row } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createReport } from '@/lib/community/api';
import { addEventReminder, REMINDER_LEADS, type ReminderLead } from '@/lib/community/events';
import type { EventPayload, ReportReason, ReportTarget } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/** A bottom sheet in the app's style. */
function Sheet({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.flex}>
        <Pressable accessibilityRole="button" style={styles.backdrop} onPress={onClose} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.background, borderColor: theme.border, paddingBottom: insets.bottom + Spacing.four },
          ]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export type SheetOption = { label: string; onPress: () => void; destructive?: boolean };

/** A list of actions (Android alerts hold three buttons at most). */
export function OptionsSheet({ options, onClose }: { options: SheetOption[] | null; onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <Sheet visible={options !== null} onClose={onClose}>
      {options?.map((option) => (
        <Row
          key={option.label}
          title={option.label}
          valueColor={option.destructive ? 'danger' : 'text'}
          onPress={() => {
            onClose();
            option.onPress();
          }}
        />
      ))}
      <Button title={t('common.cancel')} variant="ghost" onPress={onClose} />
    </Sheet>
  );
}

const REASONS: ReportReason[] = ['off_purpose', 'fitna', 'haram', 'hadith_source', 'ads', 'fake_name', 'abuse', 'other'];

/** Reports a post, comment, member or space to the admins. */
export function ReportSheet({ target, onClose }: { target: { type: ReportTarget; id: number } | null; onClose: () => void }) {
  return (
    <Sheet visible={target !== null} onClose={onClose}>
      {target ? <ReportForm key={`${target.type}:${target.id}`} target={target} onClose={onClose} /> : null}
    </Sheet>
  );
}

function ReportForm({ target, onClose }: { target: { type: ReportTarget; id: number }; onClose: () => void }) {
  const { t } = useTranslation();
  const { token } = useSession();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!reason) return;
    setSending(true);
    try {
      await createReport(token, { target_type: target.type, target_id: target.id, reason, details: details.trim() || undefined });
      onClose();
      Alert.alert(t('community.report.sent'), t('community.report.sentHint'));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AppText variant="heading" align="center">
        {t('community.report.title')}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {t('community.report.hint')}
      </AppText>
      <Chips
        options={REASONS.map((value) => ({ value, label: t(`community.report.reasons.${value}`) }))}
        value={reason ?? ('' as ReportReason)}
        onChange={setReason}
      />
      <TextField label={t('community.report.details')} value={details} onChangeText={setDetails} multiline />
      <Button title={t('community.report.send')} loading={sending} disabled={!reason} onPress={send} />
      <Button title={t('common.cancel')} variant="ghost" disabled={sending} onPress={onClose} />
    </>
  );
}

/** Adds a private reminder (an alarm on this phone) before an event. */
export function ReminderSheet({ event, onClose }: { event: EventPayload | null; onClose: () => void }) {
  const { t } = useTranslation();
  const [lead, setLead] = useState<ReminderLead>(30);
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (!event) return;
    setSaving(true);
    try {
      const added = await addEventReminder(event, lead);
      onClose();
      Alert.alert(added ? t('community.events.reminderAdded') : t('community.events.reminderTooLate'));
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={event !== null} onClose={onClose}>
      <AppText variant="heading" align="center">
        {t('community.events.remindTitle')}
      </AppText>
      <AppText variant="caption" color="textSecondary" align="center">
        {t('community.events.remindHint')}
      </AppText>
      <Chips
        options={REMINDER_LEADS.map((value) => ({ value, label: t(`community.events.leads.${value}`) }))}
        value={lead}
        onChange={setLead}
      />
      <Button title={t('community.events.addReminder')} loading={saving} onPress={add} />
      <Button title={t('common.cancel')} variant="ghost" disabled={saving} onPress={onClose} />
    </Sheet>
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
