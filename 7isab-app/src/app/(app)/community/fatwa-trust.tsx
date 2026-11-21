import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { getMyTrustRequest, requestTrust } from '@/lib/community/api';
import type { TrustFields, TrustRequest } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

const FIELDS: (keyof TrustFields)[] = ['manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching'];
const EMPTY: TrustFields = { manhaj: '', marja: '', studies: '', ijazat: '', teachers: '', institution: '', teaching: '' };

/** A request to become a trusted shaykh; the manhaj and marja' are required and shown publicly. */
export default function TrustRequestScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const [existing, setExisting] = useState<TrustRequest | null>(null);
  const [form, setForm] = useState<TrustFields>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyTrustRequest(token)
      .then((result) => {
        if (cancelled) return;
        if (result.is_shaykh) router.back();
        setExisting(result.request);
        if (result.request) setForm(Object.fromEntries(FIELDS.map((field) => [field, result.request![field] ?? ''])) as unknown as TrustFields);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token]);

  const pending = existing?.status === 'pending';

  const send = async () => {
    if (!form.manhaj?.trim() || !form.marja?.trim()) {
      Alert.alert(t('community.fatwa.trustRequired'));
      return;
    }
    setSaving(true);
    try {
      const clean = Object.fromEntries(FIELDS.map((field) => [field, form[field]?.trim() || null])) as unknown as TrustFields;
      await requestTrust(token, clean);
      Alert.alert(t('community.request.sent'), t('community.fatwa.trustSentHint'));
      router.back();
    } catch {
      Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      back
      title={t('community.fatwa.becomeShaykh')}
      footer={pending ? undefined : <Button title={t('community.request.send')} loading={saving} onPress={send} />}>
      <AppText color="textSecondary">{t('community.fatwa.trustHint')}</AppText>
      {existing ? (
        <Card tone={existing.status === 'rejected' ? 'danger' : 'accent'}>
          <AppText weight="semibold">{t(`community.fatwa.trustStatuses.${existing.status}`)}</AppText>
          {existing.admin_note ? <AppText>{existing.admin_note}</AppText> : null}
        </Card>
      ) : null}
      {FIELDS.map((field) => (
        <TextField
          key={field}
          label={`${t(`community.fatwa.fields.${field}`)}${field === 'manhaj' || field === 'marja' ? ' *' : ''}`}
          value={form[field] ?? ''}
          onChangeText={(value) => setForm({ ...form, [field]: value })}
          editable={!pending}
          multiline
        />
      ))}
    </Screen>
  );
}
