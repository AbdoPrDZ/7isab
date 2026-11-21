import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, StyleSheet, View } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { TestamentCard } from '@/components/testaments/testament-card';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import type { Testament, TestamentCategory } from '@/lib/ledger/types';
import { sendTestamentNow } from '@/lib/testaments/notifications';
import { deleteTestament, saveTestament, TESTAMENT_CATEGORIES, useTestament } from '@/lib/testaments/testaments';

/** New Testament (`id` = "new") or an existing one. Built-in Testaments can only be switched on or off. */
export default function TestamentScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const existing = useTestament(id === 'new' ? undefined : id);

  if (id !== 'new' && !existing) {
    return (
      <Screen back title={t('testaments.title')}>
        <AppText color="textSecondary">{t('testaments.notFound')}</AppText>
      </Screen>
    );
  }
  return existing?.preset ? <BuiltIn testament={existing} /> : <TestamentForm key={existing?.id ?? 'new'} existing={existing} />;
}

function BuiltIn({ testament }: { testament: Testament }) {
  const { t } = useTranslation();
  return (
    <Screen back title={t('testaments.builtInTitle')} subtitle={t('testaments.builtInHint')}>
      <TestamentCard testament={testament} highlighted />
      <Button title={t('testaments.sendNow')} variant="secondary" onPress={() => void sendTestamentNow(testament)} />
    </Screen>
  );
}

function TestamentForm({ existing }: { existing?: Testament }) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<TestamentCategory>(existing?.category ?? 'akhira');
  const [text, setText] = useState(existing?.text ?? '');
  const [source, setSource] = useState(existing?.source ?? '');
  const [enabled, setEnabled] = useState(existing?.enabled ?? true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!text.trim()) return setError(t('testaments.textRequired'));
    setSaving(true);
    await saveTestament({ id: existing?.id, category, text, source, enabled });
    router.back();
  };

  const remove = () => {
    if (!existing) return;
    Alert.alert(t('common.delete'), t('common.deleteConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => void deleteTestament(existing).then(() => router.back()),
      },
    ]);
  };

  return (
    <Screen
      back
      title={existing ? t('testaments.edit') : t('testaments.add')}
      footer={<Button title={t('common.save')} loading={saving} onPress={() => void save()} />}>
      <Section title={t('testaments.category')}>
        <Chips
          options={TESTAMENT_CATEGORIES.map((value) => ({ value, label: t(`testaments.categories.${value}`) }))}
          value={category}
          onChange={setCategory}
        />
      </Section>
      <TextField
        label={t('testaments.text')}
        placeholder={t('testaments.textPlaceholder')}
        value={text}
        onChangeText={(value) => {
          setText(value);
          setError(null);
        }}
        error={error}
        multiline
      />
      <TextField label={t('testaments.source')} placeholder={t('testaments.sourcePlaceholder')} value={source} onChangeText={setSource} />
      <Card>
        <SwitchRow label={t('testaments.enabled')} hint={t('testaments.enabledHint')} value={enabled} onChange={setEnabled} />
      </Card>
      {existing ? (
        <View style={styles.actions}>
          <Button title={t('testaments.sendNow')} variant="secondary" onPress={() => void sendTestamentNow(existing)} />
          <Button title={t('common.delete')} variant="secondary" onPress={remove} />
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { gap: Spacing.two },
});
