import { Link } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { AuthProgress } from '@/components/auth/auth-progress';
import { AuthShell } from '@/components/auth/auth-shell';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { authErrorMessage, isValidEmail } from '@/lib/api/error-message';
import { normalizeRecoveryKey } from '@/lib/crypto/keys';
import { useSession, type AuthProgress as AuthProgressState } from '@/lib/session/session-provider';

const MIN_PASSWORD = 8;

/**
 * Forgot password: the recovery key opens the data key, then a new password
 * locks it again. The data itself is never touched.
 */
export default function RecoverScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { recover } = useSession();
  const [email, setEmail] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AuthProgressState | null>(null);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!isValidEmail(email)) next.email = t('errors.invalidEmail');
    if (normalizeRecoveryKey(recoveryKey).replace(/-/g, '').length < 32) next.recoveryKey = t('errors.required');
    if (password.length < MIN_PASSWORD) next.password = t('errors.passwordTooShort');
    else if (password !== confirm) next.confirm = t('errors.passwordMismatch');
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) return;

    setProgress({ stage: 'server' });
    try {
      // On success the session guard moves to the app.
      await recover(email, recoveryKey, password, setProgress);
    } catch (error) {
      const wrongKey =
        (error instanceof ApiError && error.status === 401) ||
        (error instanceof Error && error.message === 'key_unlock_failed');
      setFormError(wrongKey ? t('account.recoverFailed') : authErrorMessage(error, t));
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <AuthShell
      title={t('account.recoverTitle')}
      subtitle={t('account.recoverSubtitle')}
      footer={
        <View style={styles.footer}>
          <Link href="/sign-in" replace disabled={busy}>
            <AppText variant="label" weight="semibold" color="primary">
              {t('account.backToSignIn')}
            </AppText>
          </Link>
        </View>
      }>
      <TextField
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        keyboardType="email-address"
        editable={!busy}
      />
      <TextField
        label={t('account.recoveryKey')}
        placeholder={t('account.recoveryKeyPlaceholder')}
        value={recoveryKey}
        onChangeText={setRecoveryKey}
        error={errors.recoveryKey}
        autoCapitalize="characters"
        autoCorrect={false}
        editable={!busy}
        style={styles.key}
      />
      <TextField
        label={t('account.newPassword')}
        placeholder={t('auth.passwordPlaceholder')}
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        secureTextEntry
        secureToggle={{ show: t('auth.showPassword'), hide: t('auth.hidePassword') }}
        editable={!busy}
      />
      <TextField
        label={t('account.confirmNewPassword')}
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
        secureTextEntry
        editable={!busy}
      />

      {formError ? (
        <View style={[styles.errorBox, { backgroundColor: theme.dangerSoft }]}>
          <AppText variant="label" color="danger">
            {formError}
          </AppText>
        </View>
      ) : null}

      <Button title={t('account.recover')} onPress={submit} loading={busy} />
      {progress ? <AuthProgress progress={progress} serverLabel={t('account.recovering')} /> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center' },
  errorBox: { borderRadius: Radius.small, padding: Spacing.three },
  key: { letterSpacing: 1, textAlign: 'left', writingDirection: 'ltr' },
});
