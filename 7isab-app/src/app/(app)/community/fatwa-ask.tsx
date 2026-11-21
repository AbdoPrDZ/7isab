import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { SwitchRow } from '@/components/prayer/quality-settings';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Row, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/client';
import { askQuestion, getShaykhs } from '@/lib/community/api';
import { useMemberProfile } from '@/lib/community/membership';
import type { Gender, ShaykhProfile } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

type Mode = 'open' | 'shaykh';

/**
 * Asking a question: to the trusted shaykhs of one gender (each may answer in
 * their own thread) or to one shaykh. The asker's name is never shown.
 */
export default function AskFatwaScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const me = useMemberProfile();
  const params = useLocalSearchParams<{ shaykhId?: string }>();
  const [mode, setMode] = useState<Mode>(params.shaykhId ? 'shaykh' : 'open');
  const [shaykhGender, setShaykhGender] = useState<Gender>(me.gender);
  const [shaykhs, setShaykhs] = useState<ShaykhProfile[]>([]);
  const [shaykhId, setShaykhId] = useState<number | null>(params.shaykhId ? Number(params.shaykhId) : null);
  const [body, setBody] = useState('');
  const [showGender, setShowGender] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getShaykhs(token)
      .then((result) => !cancelled && setShaykhs(result.shaykhs))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const send = async () => {
    if (body.trim().length < 10) {
      setError(t('community.fatwa.tooShort'));
      return;
    }
    if (mode === 'shaykh' && !shaykhId) {
      setError(t('community.fatwa.pickShaykh'));
      return;
    }
    setSending(true);
    setError(null);
    try {
      await askQuestion(token, {
        body: body.trim(),
        show_asker_gender: showGender,
        ...(mode === 'shaykh' ? { target_shaykh_id: shaykhId! } : { shaykh_gender: shaykhGender }),
      });
      Alert.alert(t('community.fatwa.sent'), t('community.fatwa.sentHint'));
      router.replace('/community/fatwa-mine');
    } catch (caught) {
      setError(caught instanceof ApiError && caught.status === 429 ? t('community.fatwa.tooMany') : t('errors.generic'));
    } finally {
      setSending(false);
    }
  };

  // Only women ask female shaykhs.
  const genders: Gender[] = me.gender === 'female' ? ['male', 'female'] : ['male'];

  return (
    <Screen back title={t('community.fatwa.ask')} footer={<Button title={t('community.fatwa.send')} loading={sending} onPress={send} />}>
      <Card tone="accent">
        <AppText>{t('community.fatwa.privacy')}</AppText>
      </Card>
      {error ? (
        <Card tone="danger">
          <AppText color="danger">{error}</AppText>
        </Card>
      ) : null}

      <Chips
        options={[
          { value: 'open' as Mode, label: t('community.fatwa.toAll') },
          { value: 'shaykh' as Mode, label: t('community.fatwa.toOne') },
        ]}
        value={mode}
        onChange={setMode}
      />

      {mode === 'open' ? (
        <Section title={t('community.fatwa.shaykhGender')}>
          <Chips
            options={genders.map((gender) => ({ value: gender, label: t(`community.fatwa.shaykhGenders.${gender}`) }))}
            value={shaykhGender}
            onChange={setShaykhGender}
          />
          <AppText variant="caption" color="textSecondary">
            {t('community.fatwa.openHint')}
          </AppText>
        </Section>
      ) : (
        <Section title={t('community.fatwa.pickShaykh')}>
          {shaykhs.length === 0 ? <AppText color="textSecondary">{t('community.fatwa.noShaykhs')}</AppText> : null}
          {shaykhs.map((shaykh) => (
            <Row
              key={shaykh.id}
              title={`${shaykh.first_name} ${shaykh.last_name}`}
              subtitle={t('community.fatwa.manhajLine', { manhaj: shaykh.manhaj, marja: shaykh.marja })}
              value={shaykh.id === shaykhId ? '✓' : undefined}
              valueColor="primary"
              onPress={() => setShaykhId(shaykh.id)}
            />
          ))}
        </Section>
      )}

      <TextField label={t('community.fatwa.yourQuestion')} value={body} onChangeText={setBody} multiline />
      <SwitchRow
        label={t(`community.fatwa.showGender.${me.gender}`)}
        hint={t('community.fatwa.showGenderHint')}
        value={showGender}
        onChange={setShowGender}
      />
    </Screen>
  );
}
