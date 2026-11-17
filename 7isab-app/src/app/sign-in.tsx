import { Link } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AuthProgress } from '@/components/auth/auth-progress';
import { AuthShell } from '@/components/auth/auth-shell';
import { AppText } from '@/components/ui/app-text';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { authErrorMessage, isValidEmail } from '@/lib/api/error-message';
import { useSession, type AuthProgress as AuthProgressState } from '@/lib/session/session-provider';

type InputRef = ComponentRef<typeof TextInput>;

export default function SignInScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { signIn } = useSession();
  const passwordRef = useRef<InputRef>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AuthProgressState | null>(null);

  const submit = async () => {
    const errors: typeof fieldErrors = {};
    if (!email.trim()) errors.email = t('errors.required');
    else if (!isValidEmail(email)) errors.email = t('errors.invalidEmail');
    if (!password) errors.password = t('errors.required');

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setProgress({ stage: 'keys', progress: 0 });
    try {
      // On success the session guard moves to the home screen.
      await signIn(email, password, setProgress);
    } catch (error) {
      setFormError(authErrorMessage(error, t));
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <AuthShell
      title={t('auth.signInTitle')}
      subtitle={t('auth.signInSubtitle')}
      footer={
        <View style={styles.footer}>
          <AppText variant="label" color="textSecondary">
            {t('auth.noAccount')}
          </AppText>
          <Link href="/sign-up" replace disabled={busy}>
            <AppText variant="label" weight="semibold" color="primary">
              {t('auth.goSignUp')}
            </AppText>
          </Link>
        </View>
      }>
      <TextField
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        editable={!busy}
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label={t('auth.password')}
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        secureToggle={{ show: t('auth.showPassword'), hide: t('auth.hidePassword') }}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        editable={!busy}
        onSubmitEditing={submit}
      />

      {formError ? (
        <View style={[styles.errorBox, { backgroundColor: theme.dangerSoft }]}>
          <AppText variant="label" color="danger">
            {formError}
          </AppText>
        </View>
      ) : null}

      <Button title={t('auth.signIn')} onPress={submit} loading={busy} />

      <Link href="/recover" replace disabled={busy} style={styles.forgot}>
        <AppText variant="label" color="primary" align="center">
          {t('account.forgotPassword')}
        </AppText>
      </Link>

      {progress ? <AuthProgress progress={progress} serverLabel={t('auth.signingIn')} /> : null}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one + Spacing.half,
  },
  forgot: {
    alignSelf: 'center',
  },
  errorBox: {
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
});
