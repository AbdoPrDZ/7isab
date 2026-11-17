import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner } from '../ui';

export default function UserDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t, date, bytes, number } = useI18n();
    const [user, setUser] = useState(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(null);
    const [message, setMessage] = useState(null);

    const load = useCallback(() => {
        api(`/users/${id}`)
            .then((data) => setUser(data.item))
            .catch(() => setError(true));
    }, [id]);

    useEffect(load, [load]);

    const run = async (action, confirmText) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(action);
        setMessage(null);
        try {
            if (action === 'delete') {
                await api(`/users/${id}`, { method: 'DELETE' });
                navigate('/admin/users');
                return;
            }
            const data = await api(`/users/${id}/${action}`, { method: 'POST' });
            if (data.item) setUser(data.item);
            else load();
            setMessage(t('done'));
        } catch {
            setMessage(t('error'));
        } finally {
            setBusy(null);
        }
    };

    if (error) return <p className="text-danger">{t('error')}</p>;
    if (!user) return <Spinner />;

    const rows = [
        [t('name'), user.name || '—'],
        [t('joined'), date(user.created_at)],
        [t('lastLogin'), date(user.last_login_at)],
        [t('lastSync'), date(user.last_sync_at)],
        [t('storage'), bytes(user.storage_bytes)],
        [t('records'), number(user.records_count)],
        [t('devices'), number(user.devices_count)],
    ];

    return (
        <div className="space-y-6">
            <Link to="/admin/users" className="text-sm font-semibold text-emerald dark:text-mint">
                ← {t('back')}
            </Link>
            <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-2xl font-bold break-all">{user.email}</h1>
                {user.is_active ? <Badge>{t('active')}</Badge> : <Badge tone="danger">{t('inactive')}</Badge>}
            </div>
            <p className="rounded-xl bg-emerald-soft p-4 text-sm text-emerald dark:bg-night-muted dark:text-mint">{t('privacy')}</p>
            <Card>
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {rows.map(([label, value]) => (
                        <div key={label}>
                            <dt className="text-xs text-ink-soft dark:text-night-ink-soft">{label}</dt>
                            <dd className="font-medium">{value}</dd>
                        </div>
                    ))}
                </dl>
            </Card>
            <Card className="space-y-3">
                <h2 className="font-semibold">{t('actions')}</h2>
                <div className="flex flex-wrap gap-2">
                    {user.is_active ? (
                        <Button variant="secondary" loading={busy === 'disable'} onClick={() => run('disable', t('confirmDisable'))}>
                            {t('disable')}
                        </Button>
                    ) : (
                        <Button variant="secondary" loading={busy === 'enable'} onClick={() => run('enable')}>
                            {t('enable')}
                        </Button>
                    )}
                    <Button variant="secondary" loading={busy === 'sign-out'} onClick={() => run('sign-out')}>
                        {t('forceSignOut')}
                    </Button>
                    <Button variant="danger" loading={busy === 'delete'} onClick={() => run('delete', t('confirmDelete'))}>
                        {t('delete')}
                    </Button>
                </div>
                {message ? <p className="text-sm text-ink-soft dark:text-night-ink-soft">{message}</p> : null}
            </Card>
        </div>
    );
}
