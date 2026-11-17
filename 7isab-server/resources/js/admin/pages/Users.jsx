import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner } from '../ui';

/** App users: metadata only (email, dates, storage, devices). */
export default function Users() {
    const { t, date, bytes, number } = useI18n();
    const [params, setParams] = useSearchParams();
    const page = Number(params.get('page') || 1);
    const search = params.get('search') || '';
    const [text, setText] = useState(search);
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api('/users', { query: { page, search, 'sort[created_at]': 'desc', pageSize: 20 } })
            .then((result) => !cancelled && setData(result))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [page, search]);

    // Debounced search.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (text !== search) setParams(text ? { search: text } : {});
        }, 350);
        return () => clearTimeout(timer);
    }, [text, search, setParams]);

    const go = (next) => setParams({ ...(search ? { search } : {}), page: String(next) });

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('users')}</h1>
            <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={t('search')}
                className="w-full rounded-xl border-2 border-line bg-white px-4 py-2.5 outline-none focus:border-emerald dark:border-night-line dark:bg-night-surface dark:focus:border-mint"
            />
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!data && !error ? <Spinner /> : null}
            {data ? (
                <Card className="overflow-hidden p-0">
                    {data.items.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-ivory-muted text-start text-ink-soft dark:bg-night-muted dark:text-night-ink-soft">
                                    <tr>
                                        <th className="px-4 py-3 text-start font-semibold">{t('email')}</th>
                                        <th className="px-4 py-3 text-start font-semibold">{t('status')}</th>
                                        <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">{t('joined')}</th>
                                        <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">{t('lastSync')}</th>
                                        <th className="hidden px-4 py-3 text-start font-semibold sm:table-cell">{t('storage')}</th>
                                        <th className="hidden px-4 py-3 text-start font-semibold lg:table-cell">{t('devices')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((user) => (
                                        <tr key={user.id} className="border-t border-line hover:bg-ivory dark:border-night-line dark:hover:bg-night-muted">
                                            <td className="px-4 py-3">
                                                <Link to={`/admin/users/${user.id}`} className="font-medium text-emerald hover:underline dark:text-mint">
                                                    {user.email}
                                                </Link>
                                                {user.name ? <div className="text-xs text-ink-soft dark:text-night-ink-soft">{user.name}</div> : null}
                                            </td>
                                            <td className="px-4 py-3">
                                                {user.is_active ? <Badge>{t('active')}</Badge> : <Badge tone="danger">{t('inactive')}</Badge>}
                                            </td>
                                            <td className="hidden px-4 py-3 md:table-cell">{date(user.created_at)}</td>
                                            <td className="hidden px-4 py-3 md:table-cell">{date(user.last_sync_at)}</td>
                                            <td className="hidden px-4 py-3 sm:table-cell">{bytes(user.storage_bytes)}</td>
                                            <td className="hidden px-4 py-3 lg:table-cell">{number(user.devices_count)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="p-8 text-center text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p>
                    )}
                </Card>
            ) : null}
            {data && data.pagesCount > 1 ? (
                <div className="flex items-center justify-between gap-3">
                    <Button variant="secondary" disabled={page <= 1} onClick={() => go(page - 1)}>
                        {t('previous')}
                    </Button>
                    <span className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {t('pageOf', { page: number(data.page), pages: number(data.pagesCount) })}
                    </span>
                    <Button variant="secondary" disabled={page >= data.pagesCount} onClick={() => go(page + 1)}>
                        {t('next')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
