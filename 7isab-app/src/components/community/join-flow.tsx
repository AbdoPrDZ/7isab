import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, BackHandler, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Chips, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { acceptRules, getCommunityRules, joinCommunity } from '@/lib/community/api';
import { ruleText, useMembership } from '@/lib/community/membership';
import type { CommunityRule, Gender, Membership } from '@/lib/community/types';
import { useSession } from '@/lib/session/session-provider';

type JoinFlowProps =
  /** Joining (or rejoining after leaving: the profile keeps its gender). */
  | { mode: 'join'; profile: Membership['profile'] }
  /** An active member accepting new or changed rules. */
  | { mode: 'accept'; rules: CommunityRule[] };

/**
 * Intro, then each rule on its own step with "I agree" (no "accept all"),
 * then names and gender. "Not now" anywhere goes back to 7isab.
 */
export function JoinFlow(props: JoinFlowProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { token } = useSession();
  const { refresh } = useMembership();
  const previous = props.mode === 'join' ? props.profile : null;

  const [loadedRules, setLoadedRules] = useState<CommunityRule[] | null>(null);
  const rules = props.mode === 'accept' ? props.rules : loadedRules;
  const [loadFailed, setLoadFailed] = useState(false);
  // Step 0 is the intro; 1..rules.length are the rules; the last step is the names (joining only).
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState(previous?.first_name ?? '');
  const [lastName, setLastName] = useState(previous?.last_name ?? '');
  const [gender, setGender] = useState<Gender | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    try {
      setLoadedRules((await getCommunityRules(token)).rules);
    } catch {
      setLoadFailed(true);
    }
  }, [token]);

  useEffect(() => {
    if (props.mode !== 'join') return;
    let cancelled = false;
    getCommunityRules(token)
      .then((result) => !cancelled && setLoadedRules(result.rules))
      .catch(() => !cancelled && setLoadFailed(true));
    return () => {
      cancelled = true;
    };
  }, [props.mode, token]);

  // The hardware back button goes one step back inside the flow.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        if (step === 0) return false;
        setStep((value) => value - 1);
        return true;
      });
      return () => subscription.remove();
    }, [step]),
  );

  const notNow = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const title = props.mode === 'join' ? t('community.join.title') : t('community.join.updatedTitle');

  if (!rules) {
    return (
      <Screen back title={title}>
        <View style={styles.center}>
          {loadFailed ? (
            <>
              <AppText color="textSecondary" align="center">
                {t('community.loadFailed')}
              </AppText>
              <Button
                title={t('community.retry')}
                variant="secondary"
                onPress={() => {
                  setLoadFailed(false);
                  loadRules();
                }}
              />
            </>
          ) : (
            <ActivityIndicator size="large" color={theme.primary} />
          )}
        </View>
      </Screen>
    );
  }

  const acceptances = rules.map(({ key, version }) => ({ key, version }));
  const rule = step >= 1 && step <= rules.length ? rules[step - 1] : null;
  const onNames = props.mode === 'join' && step === rules.length + 1;
  const firstJoin = props.mode === 'join' && !previous;

  const failed = async (caught: unknown) => {
    // The rules changed while the user was reading them: start the rules again.
    if (caught instanceof ApiError && caught.errors.rule_acceptances) {
      setError(t('community.join.rulesChanged'));
      if (props.mode === 'join') await loadRules();
      else await refresh();
      setStep(1);
      return;
    }
    setError(caught instanceof ApiError && caught.isNetworkError ? t('errors.network') : t('community.join.failed'));
  };

  const finishAccept = async () => {
    setSaving(true);
    setError(null);
    try {
      await acceptRules(token, acceptances);
      await refresh();
    } catch (caught) {
      await failed(caught);
    } finally {
      setSaving(false);
    }
  };

  const join = async () => {
    if (!firstName.trim() || !lastName.trim() || (firstJoin && !gender)) {
      setError(t('community.join.missing'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await joinCommunity(token, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        ...(firstJoin && gender ? { gender } : {}),
        rule_acceptances: acceptances,
      });
      await refresh();
    } catch (caught) {
      await failed(caught);
    } finally {
      setSaving(false);
    }
  };

  const agree = () => {
    setError(null);
    if (props.mode === 'accept' && step === rules.length) {
      finishAccept();
      return;
    }
    setStep(step + 1);
  };

  return (
    <Screen
      back
      title={title}
      footer={
        <View style={styles.footer}>
          {step === 0 ? <Button title={t('community.join.start')} onPress={() => setStep(1)} /> : null}
          {rule ? <Button title={t('community.join.agree')} loading={saving} onPress={agree} /> : null}
          {onNames ? <Button title={t('community.join.submit')} loading={saving} onPress={join} /> : null}
          <View style={styles.row}>
            {step > 0 ? (
              <Button title={t('community.join.previous')} variant="ghost" disabled={saving} style={styles.flex} onPress={() => setStep(step - 1)} />
            ) : null}
            <Button title={t('community.join.notNow')} variant="ghost" disabled={saving} style={styles.flex} onPress={notNow} />
          </View>
        </View>
      }>
      {error ? (
        <Card tone="danger">
          <AppText color="danger">{error}</AppText>
        </Card>
      ) : null}

      {step === 0 ? (
        <Section>
          <AppText variant="heading">{props.mode === 'join' ? t('community.join.introTitle') : t('community.join.updatedTitle')}</AppText>
          <AppText>{props.mode === 'join' ? t('community.join.intro') : t('community.join.updatedIntro')}</AppText>
          {props.mode === 'join' ? (
            <AppText color="textSecondary">{t('community.join.optional')}</AppText>
          ) : null}
          <AppText color="textSecondary">{t('community.join.rulesCount', { count: rules.length })}</AppText>
        </Section>
      ) : null}

      {rule ? (
        <Section title={t('community.join.ruleN', { n: step, count: rules.length })}>
          <Card tone="accent">
            <AppText variant="heading">{ruleText(rule, i18n.language)}</AppText>
          </Card>
          <AppText variant="caption" color="textSecondary">
            {t('community.join.agreeHint')}
          </AppText>
        </Section>
      ) : null}

      {onNames ? (
        <Section title={previous ? t('community.join.welcomeBack') : t('community.join.aboutYou')}>
          <AppText color="textSecondary">{t('community.join.namesHint')}</AppText>
          <TextField label={t('community.firstName')} value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
          <TextField label={t('community.lastName')} value={lastName} onChangeText={setLastName} autoComplete="family-name" />
          {firstJoin ? (
            <>
              <AppText variant="label" color="textSecondary">
                {t('community.gender')}
              </AppText>
              <Chips
                options={[
                  { value: 'male' as Gender, label: t('community.genders.male') },
                  { value: 'female' as Gender, label: t('community.genders.female') },
                ]}
                value={gender ?? ('' as Gender)}
                onChange={setGender}
              />
              <AppText variant="caption" color="textSecondary">
                {t('community.join.genderHint')}
              </AppText>
            </>
          ) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: Spacing.six, gap: Spacing.three, alignItems: 'center' },
  footer: { gap: Spacing.two },
  row: { flexDirection: 'row', gap: Spacing.two },
  flex: { flex: 1 },
});
