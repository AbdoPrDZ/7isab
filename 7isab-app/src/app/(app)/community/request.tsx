import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { ApiError } from '@/lib/api/client';
import { createSpaceRequest, getMySpaceRequests, updateSpaceRequest } from '@/lib/community/api';
import type { SpaceRequestInput, SpaceType } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

/**
 * A request for a new group or page (only admins create spaces), or the same
 * request resubmitted after the admins sent it back for changes.
 */
export default function SpaceRequestScreen() {
  const { t } = useTranslation();
  const { token } = useSession();
  const params = useLocalSearchParams<{ type?: SpaceType; id?: string }>();
  const editingId = params.id ? Number(params.id) : null;
  const [form, setForm] = useState<SpaceRequestInput>({
    type: params.type === 'page' ? 'page' : 'group',
    name: '',
    purpose: '',
    goals: '',
    content_plan: '',
    join_policy: 'open',
    audience: 'everyone',
  });
  const [note, setNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingId) return;
    let cancelled = false;
    getMySpaceRequests(token)
      .then(({ requests }) => {
        const existing = requests.find((item) => item.id === editingId);
        if (cancelled || !existing) return;
        setForm({
          type: existing.type,
          name: existing.name,
          purpose: existing.purpose,
          goals: existing.goals,
          content_plan: existing.content_plan,
          join_policy: existing.join_policy ?? 'open',
          audience: existing.audience ?? 'everyone',
        });
        setNote(existing.admin_note);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [token, editingId]);

  const set = <K extends keyof SpaceRequestInput>(key: K, value: SpaceRequestInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const send = async () => {
    setSaving(true);
    setErrors({});
    const body: SpaceRequestInput = {
      ...form,
      join_policy: form.type === 'group' ? form.join_policy : null,
      audience: form.type === 'page' ? form.audience : null,
    };
    try {
      if (editingId) await updateSpaceRequest(token, editingId, body);
      else await createSpaceRequest(token, body);
      Alert.alert(t('community.request.sent'), t('community.request.sentHint'));
      router.back();
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.errors).length) setErrors(error.errors);
      else Alert.alert(t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const required = (key: keyof SpaceRequestInput) => (errors[key] ? t('community.request.required') : null);

  return (
    <Screen
      back
      title={editingId ? t('community.request.editTitle') : t(`community.spaces.request.${form.type}`)}
      footer={<Button title={t('community.request.send')} loading={saving} onPress={send} />}>
      <AppText color="textSecondary">{t('community.request.hint')}</AppText>

      {note ? (
        <Card tone="accent">
          <AppText variant="caption" color="textSecondary">
            {t('community.request.adminNote')}
          </AppText>
          <AppText>{note}</AppText>
        </Card>
      ) : null}

      {editingId ? null : (
        <Chips
          options={[
            { value: 'group' as SpaceType, label: t('community.spaces.types.group') },
            { value: 'page' as SpaceType, label: t('community.spaces.types.page') },
          ]}
          value={form.type}
          onChange={(value) => set('type', value)}
        />
      )}

      <TextField label={t('community.request.name')} value={form.name} onChangeText={(value) => set('name', value)} error={required('name')} />
      <TextField
        label={t('community.spaces.fields.purpose')}
        value={form.purpose}
        onChangeText={(value) => set('purpose', value)}
        error={required('purpose')}
        multiline
      />
      <TextField
        label={t('community.spaces.fields.goals')}
        value={form.goals}
        onChangeText={(value) => set('goals', value)}
        error={required('goals')}
        multiline
      />
      <TextField
        label={t('community.request.contentPlan')}
        value={form.content_plan}
        onChangeText={(value) => set('content_plan', value)}
        error={required('content_plan')}
        multiline
      />

      {form.type === 'group' ? (
        <Section title={t('community.spaces.joining')}>
          <Chips
            options={[
              { value: 'open' as const, label: t('community.spaces.joinPolicies.open') },
              { value: 'approval' as const, label: t('community.spaces.joinPolicies.approval') },
            ]}
            value={form.join_policy ?? 'open'}
            onChange={(value) => set('join_policy', value)}
          />
          <AppText variant="caption" color="textSecondary">
            {t('community.request.groupGender')}
          </AppText>
        </Section>
      ) : (
        <Section title={t('community.request.audience')}>
          <Chips
            options={[
              { value: 'everyone' as const, label: t('community.spaces.audiences.everyone') },
              { value: 'gender' as const, label: t('community.spaces.audiences.gender') },
            ]}
            value={form.audience ?? 'everyone'}
            onChange={(value) => set('audience', value)}
          />
        </Section>
      )}
    </Screen>
  );
}
