import { useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner, cx } from '../ui';

const STATUSES = ['pending', 'changes_requested', 'approved', 'rejected'];

/** Group and page requests: approve, reject with a reason, or send back for changes. */
export default function SpaceRequests() {
    const { t, date } = useI18n();
    const [status, setStatus] = useState('pending');
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        api('/community/space-requests', { query: { status } })
            .then((result) => !cancelled && setData(result))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [status, reload]);

    const decide = async (item, action) => {
        let body;
        if (action !== 'approve') {
            const note = window.prompt(action === 'reject' ? t('spaces.rejectReason') : t('spaces.changesNote'));
            if (!note?.trim()) return;
            body = { note: note.trim() };
        }
        setBusy(`${item.id}:${action}`);
        try {
            await api(`/community/space-requests/${item.id}/${action}`, { method: 'POST', body });
            setReload((value) => value + 1);
        } catch {
            setError(true);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('spaces.requests')}</h1>
            <div className="flex flex-wrap gap-2">
                {STATUSES.map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setStatus(value)}
                        className={cx(
                            'rounded-full px-4 py-1.5 text-sm font-semibold',
                            status === value ? 'bg-emerald text-white dark:bg-mint dark:text-night' : 'bg-emerald-soft text-emerald dark:bg-night-muted dark:text-mint',
                        )}>
                        {t(`spaces.requestStatuses.${value}`)}
                    </button>
                ))}
            </div>
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!data && !error ? <Spinner /> : null}
            {data && !data.items.length ? <p className="text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p> : null}
            {data?.items.map((item) => (
                <Card key={item.id} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">{item.name}</h2>
                        <Badge>{t(`spaces.types.${item.type}`)}</Badge>
                        <Badge tone="gold">
                            {item.type === 'group' ? t(`spaces.joinPolicies.${item.join_policy}`) : t(`spaces.audiences.${item.audience}`)}
                        </Badge>
                    </div>
                    <p className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {item.requester?.first_name} {item.requester?.last_name} · {t(`community.genders.${item.requester?.gender}`)} · {date(item.created_at)}
                    </p>
                    <dl className="grid gap-3 text-sm sm:grid-cols-3">
                        {['purpose', 'goals', 'content_plan'].map((field) => (
                            <div key={field}>
                                <dt className="text-xs text-ink-soft dark:text-night-ink-soft">{t(`spaces.fields.${field}`)}</dt>
                                <dd className="whitespace-pre-line">{item[field]}</dd>
                            </div>
                        ))}
                    </dl>
                    {item.admin_note ? (
                        <p className="rounded-xl bg-gold-soft p-3 text-sm text-[#7a5f10] dark:bg-night-muted dark:text-gold">{item.admin_note}</p>
                    ) : null}
                    {item.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                            <Button loading={busy === `${item.id}:approve`} onClick={() => decide(item, 'approve')}>
                                {t('spaces.approve')}
                            </Button>
                            <Button variant="secondary" loading={busy === `${item.id}:request-changes`} onClick={() => decide(item, 'request-changes')}>
                                {t('spaces.requestChanges')}
                            </Button>
                            <Button variant="danger" loading={busy === `${item.id}:reject`} onClick={() => decide(item, 'reject')}>
                                {t('spaces.reject')}
                            </Button>
                        </div>
                    ) : null}
                </Card>
            ))}
        </div>
    );
}
