import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';

import { AuthProgress } from '@/components/auth/auth-progress';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { Card, Screen, Section } from '@/components/ui/layout';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ApiError } from '@/lib/api/client';
import { authErrorMessage } from '@/lib/api/error-message';
import { biometricAvailable } from '@/lib/lock/app-lock';
import { isKeyProtected } from '@/lib/session/storage';
import { useSession, type AuthProgress as AuthProgressState } from '@/lib/session/session-provider';

const MIN_PASSWORD = 8;

/** Change password, new recovery key, and fingerprint protection of the data key. */
export default function AccountScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { changePassword, replaceRecoveryKey, setKeyProtection } = useSession();

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordInfo, setPasswordInfo] = useState<string | null>(null);
  const [passwordProgress, setPasswordProgress] = useState<AuthProgressState | null>(null);

  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryProgress, setRecoveryProgress] = useState<AuthProgressState | null>(null);

  const [biometric, setBiometric] = useState(false);
  const [protectedKey, setProtectedKey] = useState(isKeyProtected());
  const [protectError, setProtectError] = useState<string | null>(null);

  useEffect(() => {
    void biometricAvailable().then(setBiometric);
  }, []);

  const keyError = (error: unknown) =>
    error instanceof ApiError && (error.status === 401 || error.status === 422)
      ? t('account.wrongPassword')
      : authErrorMessage(error, t);

  const submitPassword = async () => {
    setPasswordInfo(null);
    if (!current) return setPasswordError(t('errors.required'));
    if (next.length < MIN_PASSWORD) return setPasswordError(t('errors.passwordTooShort'));
    if (next !== confirm) return setPasswordError(t('errors.passwordMismatch'));
    setPasswordError(null);
    setPasswordProgress({ stage: 'server' });
    try {
      await changePassword(current, next, setPasswordProgress);
      setCurrent('');
      setNext('');
      setConfirm('');
      setPasswordInfo(t('account.passwordChanged'));
    } catch (error) {
      setPasswordError(keyError(error));
    } finally {
      setPasswordProgress(null);
    }
  };

  const submitRecovery = async () => {
    if (!recoveryPassword) return setRecoveryError(t('errors.required'));
    setRecoveryError(null);
    setRecoveryProgress({ stage: 'server' });
    try {
      // On success the new key is shown on the recovery-key screen.
      await replaceRecoveryKey(recoveryPassword, setRecoveryProgress);
      setRecoveryPassword('');
    } catch (error) {
      setRecoveryError(keyError(error));
    } finally {
      setRecoveryProgress(null);
    }
  };

  const toggleProtection = async (enabled: boolean) => {
    setProtectError(null);
    try {
      await setKeyProtection(enabled);
      setProtectedKey(enabled);
    } catch {
      setProtectError(t('account.protectFailed'));
    }
  };

  return (
    <Screen back title={t('account.title')}>
      <Section title={t('account.changePassword')}>
        <Card>
          <AppText variant="caption" color="textSecondary">
            {t('account.changePasswordHint')}
          </AppText>
          <TextField label={t('account.currentPassword')} value={current} onChangeText={setCurrent} secureTextEntry />
          <TextField
            label={t('account.newPassword')}
            placeholder={t('auth.passwordPlaceholder')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            secureToggle={{ show: t('auth.showPassword'), hide: t('auth.hidePassword') }}
          />
          <TextField label={t('account.confirmNewPassword')} value={confirm} onChangeText={setConfirm} secureTextEntry error={passwordError} />
          {passwordInfo ? (
            <AppText variant="label" color="primary">
              {passwordInfo}
            </AppText>
          ) : null}
          <Button title={t('account.changePassword')} loading={!!passwordProgress} onPress={() => void submitPassword()} />
          {passwordProgress ? <AuthProgress progress={passwordProgress} serverLabel={t('account.working')} /> : null}
        </Card>
      </Section>

      <Section title={t('account.replaceRecovery')}>
        <Card>
          <AppText variant="caption" color="textSecondary">
            {t('account.replaceRecoveryHint')}
          </AppText>
          <TextField
            label={t('account.confirmWithPassword')}
            value={recoveryPassword}
            onChangeText={setRecoveryPassword}
            secureTextEntry
            error={recoveryError}
          />
          <Button
            title={t('account.replaceRecovery')}
            variant="secondary"
            loading={!!recoveryProgress}
            onPress={() => void submitRecovery()}
          />
          {recoveryProgress ? <AuthProgress progress={recoveryProgress} serverLabel={t('account.working')} /> : null}
        </Card>
      </Section>

      {biometric ? (
        <Card>
          <View style={styles.switchRow}>
            <AppText variant="label" style={styles.flex}>
              {t('account.protectKey')}
            </AppText>
            <Switch value={protectedKey} onValueChange={(value) => void toggleProtection(value)} trackColor={{ true: theme.primary }} />
          </View>
          <AppText variant="caption" color="textSecondary">
            {t('account.protectKeyHint')}
          </AppText>
          {protectError ? (
            <AppText variant="caption" color="danger">
              {protectError}
            </AppText>
          ) : null}
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
});
