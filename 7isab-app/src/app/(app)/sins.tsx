import { Fragment, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText, useFontFamily } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Divider, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { monthOf, today } from '@/lib/dates';
import { newId, putDoc, removeDoc } from '@/lib/data/vault';
import { parseAmount } from '@/lib/format';
import { useEntries, useLedgerLabels, useSinTypes } from '@/lib/ledger/hooks';
import { logSin } from '@/lib/ledger/ledger';
import { RecordTypes, type SinType } from '@/lib/ledger/types';

function PenaltyInput({ sin }: { sin: SinType }) {
  const theme = useTheme();
  const fontFamily = useFontFamily('semibold');
  const [text, setText] = useState(String(sin.penalty));

  return (
    <TextInput
      value={text}
      onChangeText={setText}
      onEndEditing={() => {
        const value = parseAmount(text);
        if (value !== null && value >= 0 && value !== sin.penalty) void putDoc<SinType>(RecordTypes.sinType, { ...sin, penalty: value });
        else setText(String(sin.penalty));
      }}
      keyboardType="decimal-pad"
      style={[styles.penalty, { borderColor: theme.border, color: theme.text, fontFamily }]}
    />
  );
}

/**
 * Sins: logging (from Home) or, with ?mode=edit (from Settings), editing the
 * types and their penalties.
 */
export default function SinsScreen() {
  const { t } = useTranslation();
  const editing = useLocalSearchParams<{ mode?: string }>().mode === 'edit';
  const theme = useTheme();
  const sinTypes = useSinTypes();
  const entries = useEntries();
  const { sinName, format } = useLedgerLabels();
  const [justLogged, setJustLogged] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const month = monthOf(today());
  const recent = entries.filter((entry) => entry.kind === 'sin' && monthOf(entry.date) === month);

  const log = async (sin: SinType) => {
    await logSin(sin);
    setJustLogged(sin.id);
    setTimeout(() => setJustLogged((current) => (current === sin.id ? null : current)), 1500);
  };

  const addType = async () => {
    if (!newName.trim()) return;
    await putDoc<SinType>(RecordTypes.sinType, { id: newId(), name: newName.trim(), penalty: 1, order: sinTypes.length + 100 });
    setNewName('');
  };

  const removeType = (sin: SinType) =>
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void removeDoc(RecordTypes.sinType, sin.id) },
    ]);

  return (
    <Screen
      back
      title={editing ? t('settingsExtra.sinTypes') : t('sins.title')}
      subtitle={editing ? t('sins.editHint') : t('sins.subtitle')}>
      <Card>
        {sinTypes.map((sin, index) => (
          <Fragment key={sin.id}>
            {index > 0 ? <Divider /> : null}
            <Pressable onLongPress={editing && !sin.preset ? () => removeType(sin) : undefined} style={styles.sinRow}>
              <View style={styles.flex}>
                <AppText variant="label">{sinName(sin)}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {t('sins.penalty')}
                </AppText>
              </View>
              {editing ? (
                <PenaltyInput sin={sin} />
              ) : (
                <AppText variant="label" weight="semibold" color="danger">
                  {format.points(sin.penalty)}
                </AppText>
              )}
              {editing ? null : (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => void log(sin)}
                  style={({ pressed }) => [
                    styles.logButton,
                    { backgroundColor: justLogged === sin.id ? theme.accent : pressed ? theme.primaryPressed : theme.primary },
                  ]}>
                  <AppText variant="label" weight="semibold" color="textOnPrimary">
                    {justLogged === sin.id ? t('sins.logged') : t('sins.log')}
                  </AppText>
                </Pressable>
              )}
            </Pressable>
          </Fragment>
        ))}
      </Card>

      {editing ? (
        <View style={styles.addRow}>
          <View style={styles.flex}>
            <TextField label={t('sins.addType')} placeholder={t('sins.typeName')} value={newName} onChangeText={setNewName} />
          </View>
          <Button title={t('common.add')} variant="secondary" onPress={() => void addType()} style={styles.addButton} />
        </View>
      ) : null}

      {editing ? null : (
        <Section title={t('sins.recent')}>
          <Card>
            {recent.length ? (
              recent.map((entry, index) => {
                const sin = sinTypes.find((item) => item.id === entry.sinTypeId);
                return (
                  <Fragment key={entry.id}>
                    {index > 0 ? <Divider /> : null}
                    <Row
                      title={sin ? sinName(sin) : t('hisab.kinds.sin')}
                      subtitle={format.day(entry.date)}
                      value={format.points(entry.lines.find((line) => line.amount > 0)?.amount ?? 0)}
                      valueColor="danger"
                    />
                  </Fragment>
                );
              })
            ) : (
              <AppText variant="label" color="textSecondary" align="center">
                {t('sins.noRecent')}
              </AppText>
            )}
          </Card>
        </Section>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sinRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.two },
  penalty: {
    width: 52,
    borderWidth: 1,
    borderRadius: Radius.small,
    paddingVertical: Spacing.one,
    textAlign: 'center',
    fontSize: 15,
  },
  logButton: { borderRadius: Radius.small, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two, minWidth: 72, alignItems: 'center' },
  addRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.two },
  addButton: { minHeight: 52 },
});
