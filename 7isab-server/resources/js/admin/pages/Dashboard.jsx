import { useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Card, Spinner } from '../ui';

function Stat({ label, value, accent }) {
    return (
        <Card className={accent ? 'border-gold bg-gold-soft dark:border-gold' : ''}>
            <div className="text-sm text-ink-soft dark:text-night-ink-soft">{label}</div>
            <div className="mt-1 text-3xl font-bold text-emerald dark:text-mint">{value}</div>
        </Card>
    );
}

export default function Dashboard() {
    const { t, number, bytes } = useI18n();
    const [stats, setStats] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        api('/stats')
            .then((data) => setStats(data.statistics))
            .catch(() => setError(true));
    }, []);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('dashboard')}</h1>
            <p className="rounded-xl bg-emerald-soft p-4 text-sm text-emerald dark:bg-night-muted dark:text-mint">{t('privacy')}</p>
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!stats && !error ? <Spinner /> : null}
            {stats ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label={t('totalUsers')} value={number(stats.users.total)} accent />
                    <Stat label={t('activeUsers')} value={number(stats.users.active)} />
                    <Stat label={t('disabledUsers')} value={number(stats.users.disabled)} />
                    <Stat label={t('newUsers')} value={number(stats.users.new_last_30_days)} />
                    <Stat label={t('syncedUsers')} value={number(stats.users.synced_last_7_days)} />
                    <Stat label={t('records')} value={number(stats.records)} />
                    <Stat label={t('storage')} value={bytes(stats.storage_bytes)} />
                    <Stat label={t('adminCount')} value={number(stats.admins)} />
                </div>
            ) : null}
        </div>
    );
}
