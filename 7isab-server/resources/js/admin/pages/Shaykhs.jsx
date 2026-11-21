import { useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner, cx } from '../ui';

const FIELDS = ['manhaj', 'marja', 'studies', 'ijazat', 'teachers', 'institution', 'teaching'];

/** Trust requests (approve or reject with a reason) and trusted shaykhs (withdraw trust). */
export default function Shaykhs() {
    const { t, date } = useI18n();
    const [tab, setTab] = useState('requests');
    const [items, setItems] = useState(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setItems(null);
        api(tab === 'requests' ? '/community/shaykh-requests' : '/community/shaykhs')
            .then((result) => !cancelled && setItems(result.items))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [tab, reload]);

    const run = async (path, confirmText, body) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(path);
        try {
            await api(path, { method: 'POST', body });
            setReload((value) => value + 1);
        } catch {
            setError(true);
        } finally {
            setBusy(null);
        }
    };

    const reject = (item) => {
        const note = window.prompt(t('shaykhs.rejectReason'));
        if (note?.trim()) run(`/community/shaykh-requests/${item.id}/reject`, null, { note: note.trim() });
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('shaykhs.title')}</h1>
            <div className="flex flex-wrap gap-2">
                {['requests', 'trusted'].map((value) => (
                    <button
                        key={value}
                        type="button"
                        onClick={() => setTab(value)}
                        className={cx(
                            'rounded-full px-4 py-1.5 text-sm font-semibold',
                            tab === value ? 'bg-emerald text-white dark:bg-mint dark:text-night' : 'bg-emerald-soft text-emerald dark:bg-night-muted dark:text-mint',
                        )}>
                        {t(`shaykhs.tabs.${value}`)}
                    </button>
                ))}
            </div>
            <p className="rounded-xl bg-emerald-soft p-4 text-sm text-emerald dark:bg-night-muted dark:text-mint">{t('shaykhs.hint')}</p>
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!items && !error ? <Spinner /> : null}
            {items && !items.length ? <p className="text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p> : null}
            {items?.map((item) => (
                <Card key={item.id} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-semibold">
                            {item.profile?.first_name} {item.profile?.last_name}
                        </h2>
                        <Badge>{t(`community.genders.${item.profile?.gender}`)}</Badge>
                        {tab === 'trusted' ? (
                            item.withdrawn_at ? <Badge tone="danger">{t('shaykhs.withdrawn')}</Badge> : <Badge tone="gold">{t('shaykhs.trusted')}</Badge>
                        ) : null}
                        <span className="text-xs text-ink-soft dark:text-night-ink-soft">{date(item.trusted_at ?? item.created_at)}</span>
                    </div>
                    <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        {FIELDS.filter((field) => item[field]).map((field) => (
                            <div key={field}>
                                <dt className="text-xs text-ink-soft dark:text-night-ink-soft">{t(`shaykhs.fields.${field}`)}</dt>
                                <dd className="whitespace-pre-line">{item[field]}</dd>
                            </div>
                        ))}
                    </dl>
                    {tab === 'requests' ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                loading={busy === `/community/shaykh-requests/${item.id}/approve`}
                                onClick={() => run(`/community/shaykh-requests/${item.id}/approve`, t('shaykhs.confirmApprove'))}>
                                {t('shaykhs.approve')}
                            </Button>
                            <Button variant="danger" loading={busy === `/community/shaykh-requests/${item.id}/reject`} onClick={() => reject(item)}>
                                {t('shaykhs.reject')}
                            </Button>
                        </div>
                    ) : !item.withdrawn_at ? (
                        <Button
                            variant="danger"
                            loading={busy === `/community/shaykhs/${item.id}/withdraw`}
                            onClick={() => run(`/community/shaykhs/${item.id}/withdraw`, t('shaykhs.confirmWithdraw'))}>
                            {t('shaykhs.withdraw')}
                        </Button>
                    ) : null}
                </Card>
            ))}
        </div>
    );
}
