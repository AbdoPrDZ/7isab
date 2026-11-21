import { useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner, cx } from '../ui';

const STATUSES = ['pending', 'actioned', 'dismissed'];

/** Reports from members: see the reported content, then hide it, act on its author, or dismiss. */
export default function Reports() {
    const { t, date, number } = useI18n();
    const [status, setStatus] = useState('pending');
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setData(null);
        api('/community/reports', { query: { status } })
            .then((result) => !cancelled && setData(result))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [status, reload]);

    const run = async (report, action) => {
        const confirmText = { suspend: t('reports.confirmSuspend'), ban: t('reports.confirmBan') }[action];
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(`${report.id}:${action}`);
        try {
            await api(`/community/reports/${report.id}/${action}`, { method: 'POST' });
            setReload((value) => value + 1);
        } catch {
            setError(true);
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('reports.title')}</h1>
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
                        {t(`reports.statuses.${value}`)}
                    </button>
                ))}
            </div>
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!data && !error ? <Spinner /> : null}
            {data && !data.items.length ? <p className="text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p> : null}
            {data?.items.map((report) => (
                <Card key={report.id} className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="danger">{t(`reports.reasons.${report.reason}`)}</Badge>
                        <Badge>{t(`reports.targets.${report.target_type}`)}</Badge>
                        {report.same_target_count > 1 ? <Badge tone="gold">{t('reports.sameTarget', { count: number(report.same_target_count) })}</Badge> : null}
                        <span className="text-xs text-ink-soft dark:text-night-ink-soft">{date(report.created_at)}</span>
                    </div>
                    <p className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {t('reports.by', { name: `${report.reporter?.first_name ?? ''} ${report.reporter?.last_name ?? ''}` })}
                    </p>
                    {report.details ? <p className="text-sm">{report.details}</p> : null}
                    <Target target={report.target} />
                    {report.status === 'pending' ? (
                        <div className="flex flex-wrap gap-2">
                            {report.target_type !== 'profile' ? (
                                <Button loading={busy === `${report.id}:hide`} onClick={() => run(report, 'hide')}>
                                    {report.target_type === 'space' ? t('reports.closeSpace') : t('reports.hide')}
                                </Button>
                            ) : null}
                            {report.target?.author_id ? (
                                <>
                                    <Button variant="secondary" loading={busy === `${report.id}:suspend`} onClick={() => run(report, 'suspend')}>
                                        {t('reports.suspendAuthor')}
                                    </Button>
                                    <Button variant="danger" loading={busy === `${report.id}:ban`} onClick={() => run(report, 'ban')}>
                                        {t('reports.banAuthor')}
                                    </Button>
                                </>
                            ) : null}
                            <Button variant="ghost" loading={busy === `${report.id}:dismiss`} onClick={() => run(report, 'dismiss')}>
                                {t('reports.dismiss')}
                            </Button>
                        </div>
                    ) : null}
                </Card>
            ))}
        </div>
    );
}

function Target({ target }) {
    const { t } = useI18n();
    if (!target) return <p className="text-sm text-ink-soft dark:text-night-ink-soft">{t('reports.gone')}</p>;

    const text = target.body || target.payload?.text || target.name || target.purpose;
    return (
        <div className="space-y-1 rounded-xl bg-ivory-muted p-4 text-sm dark:bg-night-muted">
            {target.author ? (
                <p className="font-semibold">
                    {target.author.first_name} {target.author.last_name} · {t(`community.genders.${target.author.gender}`)} ·{' '}
                    {t(`community.statuses.${target.author.status}`)}
                </p>
            ) : null}
            {target.space ? <p className="text-xs text-ink-soft dark:text-night-ink-soft">{target.space}</p> : null}
            {text ? <p className="whitespace-pre-line">{text}</p> : null}
            {target.payload?.ayat ? (
                <p dir="rtl" className="font-arabic text-lg">
                    {target.payload.ayat.map((ayah) => ayah.text).join(' ')}
                </p>
            ) : null}
        </div>
    );
}
