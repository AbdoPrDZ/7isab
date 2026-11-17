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

const MIN_PASSWORD_LENGTH = 8;

type Fields = 'name' | 'email' | 'password' | 'confirm';

export default function SignUpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { signUp } = useSession();
  const emailRef = useRef<InputRef>(null);
  const passwordRef = useRef<InputRef>(null);
  const confirmRef = useRef<InputRef>(null);

  const [values, setValues] = useState<Record<Fields, string>>({ name: '', email: '', password: '', confirm: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<Fields, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [progress, setProgress] = useState<AuthProgressState | null>(null);

  const set = (field: Fields) => (text: string) => setValues((current) => ({ ...current, [field]: text }));

  const submit = async () => {
    const errors: typeof fieldErrors = {};
    if (!values.email.trim()) errors.email = t('errors.required');
    else if (!isValidEmail(values.email)) errors.email = t('errors.invalidEmail');
    if (values.password.length < MIN_PASSWORD_LENGTH) errors.password = t('errors.passwordTooShort');
    if (values.confirm !== values.password) errors.confirm = t('errors.passwordMismatch');

    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length) return;

    setProgress({ stage: 'keys', progress: 0 });
    try {
      // On success the guard shows the recovery key screen.
      await signUp(values.name, values.email, values.password, setProgress);
    } catch (error) {
      setFormError(authErrorMessage(error, t));
      setProgress(null);
    }
  };

  const busy = progress !== null;

  return (
    <AuthShell
      title={t('auth.signUpTitle')}
      subtitle={t('auth.signUpSubtitle')}
      footer={
        <View style={styles.footer}>
          <AppText variant="label" color="textSecondary">
            {t('auth.haveAccount')}
          </AppText>
          <Link href="/sign-in" replace disabled={busy}>
            <AppText variant="label" weight="semibold" color="primary">
              {t('auth.goSignIn')}
            </AppText>
          </Link>
        </View>
      }>
      <TextField
        label={t('auth.name')}
        placeholder={t('auth.namePlaceholder')}
        value={values.name}
        onChangeText={set('name')}
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        editable={!busy}
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label={t('auth.email')}
        placeholder={t('auth.emailPlaceholder')}
        value={values.email}
        onChangeText={set('email')}
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
        placeholder={t('auth.passwordPlaceholder')}
        value={values.password}
        onChangeText={set('password')}
        error={fieldErrors.password}
        secureTextEntry
        secureToggle={{ show: t('auth.showPassword'), hide: t('auth.hidePassword') }}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        editable={!busy}
        onSubmitEditing={() => confirmRef.current?.focus()}
      />
      <TextField
        ref={confirmRef}
        label={t('auth.confirmPassword')}
        value={values.confirm}
        onChangeText={set('confirm')}
        error={fieldErrors.confirm}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
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

      <Button title={t('auth.signUp')} onPress={submit} loading={busy} />

      {progress ? <AuthProgress progress={progress} serverLabel={t('auth.creatingAccount')} /> : null}
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
  errorBox: {
    borderRadius: Radius.small,
    padding: Spacing.three,
  },
});
