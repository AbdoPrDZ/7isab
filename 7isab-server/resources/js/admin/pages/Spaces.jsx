import { useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner } from '../ui';

const SELECT =
    'rounded-xl border-2 border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald dark:border-night-line dark:bg-night-surface dark:focus:border-mint';

/** Every group and page: close, reopen, or transfer to another member of the owner's gender. */
export default function Spaces() {
    const { t, number } = useI18n();
    const [type, setType] = useState('');
    const [status, setStatus] = useState('');
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        const timer = setTimeout(() => {
            api('/community/spaces', { query: { type, status, search, page } })
                .then((result) => !cancelled && setData(result))
                .catch(() => !cancelled && setError(t('error')));
        }, 250);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [type, status, search, page, reload, t]);

    const run = async (space, action) => {
        let body;
        if (action === 'transfer') {
            const id = window.prompt(t('spaces.transferPrompt'));
            if (!id?.trim()) return;
            body = { profile_id: Number(id.trim()) };
        } else if (action === 'close' && !window.confirm(t('spaces.confirmClose'))) {
            return;
        }
        setBusy(`${space.id}:${action}`);
        setError(null);
        try {
            await api(`/community/spaces/${space.id}/${action}`, { method: 'POST', body });
            setReload((value) => value + 1);
        } catch (caught) {
            setError(caught.errors?.profile_id ?? t('error'));
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('spaces.title')}</h1>
            <div className="flex flex-wrap gap-2">
                <input
                    value={search}
                    onChange={(event) => {
                        setSearch(event.target.value);
                        setPage(1);
                    }}
                    placeholder={t('spaces.search')}
                    className="min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-4 py-2.5 outline-none focus:border-emerald dark:border-night-line dark:bg-night-surface dark:focus:border-mint"
                />
                <select aria-label={t('spaces.type')} value={type} onChange={(event) => setType(event.target.value)} className={SELECT}>
                    <option value="">{t('spaces.allTypes')}</option>
                    <option value="group">{t('spaces.types.group')}</option>
                    <option value="page">{t('spaces.types.page')}</option>
                </select>
                <select aria-label={t('status')} value={status} onChange={(event) => setStatus(event.target.value)} className={SELECT}>
                    <option value="">{t('community.allStatuses')}</option>
                    <option value="active">{t('spaces.statuses.active')}</option>
                    <option value="closed">{t('spaces.statuses.closed')}</option>
                </select>
            </div>
            {error ? <p className="text-danger">{error}</p> : null}
            {!data && !error ? <Spinner /> : null}
            {data && !data.items.length ? <p className="text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p> : null}
            {data?.items.map((space) => (
                <Card key={space.id} className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{space.name}</h2>
                        <Badge>{t(`spaces.types.${space.type}`)}</Badge>
                        <Badge tone="gold">{space.gender ? t(`community.genders.${space.gender}`) : t('spaces.audiences.everyone')}</Badge>
                        <Badge tone={space.status === 'active' ? 'emerald' : 'danger'}>{t(`spaces.statuses.${space.status}`)}</Badge>
                    </div>
                    <p className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {t('spaces.ownerLine', {
                            owner: `${space.owner?.first_name ?? ''} ${space.owner?.last_name ?? ''}`,
                            id: space.owner?.id,
                            count: number(space.members_count),
                        })}
                    </p>
                    <p className="text-sm">{space.purpose}</p>
                    <div className="flex flex-wrap gap-2">
                        {space.status === 'active' ? (
                            <Button variant="danger" loading={busy === `${space.id}:close`} onClick={() => run(space, 'close')}>
                                {t('spaces.close')}
                            </Button>
                        ) : (
                            <Button variant="secondary" loading={busy === `${space.id}:reopen`} onClick={() => run(space, 'reopen')}>
                                {t('spaces.reopen')}
                            </Button>
                        )}
                        <Button variant="ghost" loading={busy === `${space.id}:transfer`} onClick={() => run(space, 'transfer')}>
                            {t('spaces.transfer')}
                        </Button>
                    </div>
                </Card>
            ))}
            {data && data.pagesCount > 1 ? (
                <div className="flex items-center justify-between gap-3">
                    <Button variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        {t('previous')}
                    </Button>
                    <span className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {t('pageOf', { page: number(data.page), pages: number(data.pagesCount) })}
                    </span>
                    <Button variant="secondary" disabled={page >= data.pagesCount} onClick={() => setPage(page + 1)}>
                        {t('next')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
