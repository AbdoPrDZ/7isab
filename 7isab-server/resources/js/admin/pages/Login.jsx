import { useState } from 'react';

import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Preferences } from '../Layout';
import { Button, Card, Field, Logo } from '../ui';

export default function Login() {
    const { signIn } = useAuth();
    const { t } = useI18n();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await signIn(email.trim(), password);
        } catch (failure) {
            setError(failure.status === 0 ? t('network') : failure.status === 403 ? t('disabled') : failure.status === 401 ? t('invalid') : t('error'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pattern flex min-h-screen flex-col items-center justify-center gap-6 bg-emerald p-4 dark:bg-[#10392d]">
            <Preferences />
            <Card className="w-full max-w-sm space-y-5">
                <div className="flex items-center gap-3">
                    <Logo className="size-11" />
                    <div>
                        <h1 className="text-xl font-bold">{t('appName')}</h1>
                        <p className="text-sm text-ink-soft dark:text-night-ink-soft">{t('admin')}</p>
                    </div>
                </div>
                <p className="rounded-xl bg-emerald-soft p-3 text-xs text-emerald dark:bg-night-muted dark:text-mint">{t('signInHint')}</p>
                <form className="space-y-4" onSubmit={submit}>
                    <Field label={t('email')} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
                    <Field
                        label={t('password')}
                        type="password"
                        autoComplete="current-password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        error={error}
                    />
                    <Button type="submit" className="w-full" loading={loading}>
                        {t('signIn')}
                    </Button>
                </form>
            </Card>
        </div>
    );
}
