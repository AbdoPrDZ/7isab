/**
 * Editable list of reasons for one scope (praying at home, sleeping late…):
 * switch each between excused and Thanb, add your own, long-press to delete.
 * With `thanbLocked`, the switches are disabled (every reason counts as Thanb).
 */
import { Fragment, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { newId, putDoc, removeDoc } from '@/lib/data/vault';
import { useReasonName, useReasons } from '@/lib/ledger/reasons';
import { RecordTypes, type Reason, type ReasonScope } from '@/lib/ledger/types';

export function ReasonsEditor({ scope, thanbLocked = false }: { scope: ReasonScope; thanbLocked?: boolean }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reasons = useReasons(scope);
  const reasonName = useReasonName();
  const [newName, setNewName] = useState('');

  const add = async () => {
    const name = newName.trim();
    if (!name) return;
    await putDoc<Reason>(RecordTypes.reason, { id: newId(), scope, name, thanb: true, order: reasons.length + 100 });
    setNewName('');
  };

  const remove = (reason: Reason) =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void removeDoc(RecordTypes.reason, reason.id) },
    ]);

  return (
    <>
      <Card>
        {reasons.map((reason, index) => (
          <Fragment key={reason.id}>
            {index > 0 ? <Divider /> : null}
            <Pressable onLongPress={() => remove(reason)} style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="label">{reasonName(reason)}</AppText>
                <AppText variant="caption" color={reason.thanb || thanbLocked ? 'danger' : 'primary'}>
                  {reason.thanb || thanbLocked ? t('reasons.countsThanb') : t('reasons.excused')}
                </AppText>
              </View>
              <Switch
                value={reason.thanb || thanbLocked}
                disabled={thanbLocked}
                onValueChange={(thanb) => void putDoc<Reason>(RecordTypes.reason, { ...reason, thanb })}
                trackColor={{ true: theme.danger }}
              />
            </Pressable>
          </Fragment>
        ))}
      </Card>
      <View style={styles.addRow}>
        <View style={styles.flex}>
          <TextField label={t('reasons.add')} placeholder={t('reasons.name')} value={newName} onChangeText={setNewName} />
        </View>
        <Button title={t('common.add')} variant="secondary" onPress={() => void add()} style={styles.addButton} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, paddingVertical: Spacing.two },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  addButton: { minHeight: 52 },
});
