import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Spinner } from '../ui';

const STATUS_TONES = { active: 'emerald', left: 'gold', suspended: 'danger', banned: 'danger' };
const SELECT =
    'rounded-xl border-2 border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald dark:border-night-line dark:bg-night-surface dark:focus:border-mint';

/** Community members: suspend, ban, reactivate, and change gender (admins only). */
export default function CommunityMembers() {
    const { t, date, number } = useI18n();
    const [params, setParams] = useSearchParams();
    const page = Number(params.get('page') || 1);
    const search = params.get('search') || '';
    const gender = params.get('gender') || '';
    const status = params.get('status') || '';
    const [text, setText] = useState(search);
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);
    const [busy, setBusy] = useState(null);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let cancelled = false;
        api('/community/members', { query: { page, search, gender, status, 'sort[created_at]': 'desc', pageSize: 20 } })
            .then((result) => !cancelled && setData(result))
            .catch(() => !cancelled && setError(true));
        return () => {
            cancelled = true;
        };
    }, [page, search, gender, status, reload]);

    const update = (changes) => {
        const next = { search, gender, status, ...changes };
        setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)));
    };

    // Debounced search.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (text !== search) update({ search: text, page: '' });
        }, 350);
        return () => clearTimeout(timer);
    }, [text, search]);

    const run = async (member, action, confirmText, body) => {
        if (confirmText && !window.confirm(confirmText)) return;
        setBusy(`${member.id}:${action}`);
        try {
            await api(`/community/members/${member.id}/${action}`, { method: action === 'gender' ? 'PUT' : 'POST', body });
            setReload((value) => value + 1);
        } catch {
            setError(true);
        } finally {
            setBusy(null);
        }
    };

    const otherGender = (member) => (member.gender === 'male' ? 'female' : 'male');

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold">{t('community.members')}</h1>
            <div className="flex flex-wrap gap-2">
                <input
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder={t('community.searchMembers')}
                    className="min-w-0 flex-1 rounded-xl border-2 border-line bg-white px-4 py-2.5 outline-none focus:border-emerald dark:border-night-line dark:bg-night-surface dark:focus:border-mint"
                />
                <select aria-label={t('community.gender')} value={gender} onChange={(event) => update({ gender: event.target.value, page: '' })} className={SELECT}>
                    <option value="">{t('community.allGenders')}</option>
                    <option value="male">{t('community.genders.male')}</option>
                    <option value="female">{t('community.genders.female')}</option>
                </select>
                <select aria-label={t('status')} value={status} onChange={(event) => update({ status: event.target.value, page: '' })} className={SELECT}>
                    <option value="">{t('community.allStatuses')}</option>
                    {Object.keys(STATUS_TONES).map((value) => (
                        <option key={value} value={value}>
                            {t(`community.statuses.${value}`)}
                        </option>
                    ))}
                </select>
            </div>
            {error ? <p className="text-danger">{t('error')}</p> : null}
            {!data && !error ? <Spinner /> : null}
            {data ? (
                <Card className="overflow-hidden p-0">
                    {data.items.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-ivory-muted text-ink-soft dark:bg-night-muted dark:text-night-ink-soft">
                                    <tr>
                                        <th className="px-4 py-3 text-start font-semibold">{t('name')}</th>
                                        <th className="px-4 py-3 text-start font-semibold">{t('community.gender')}</th>
                                        <th className="px-4 py-3 text-start font-semibold">{t('status')}</th>
                                        <th className="hidden px-4 py-3 text-start font-semibold md:table-cell">{t('joined')}</th>
                                        <th className="px-4 py-3 text-start font-semibold">{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.items.map((member) => (
                                        <tr key={member.id} className="border-t border-line align-top dark:border-night-line">
                                            <td className="px-4 py-3">
                                                <div className="font-medium">
                                                    {member.first_name} {member.last_name}
                                                </div>
                                                <Link to={`/admin/users/${member.user_id}`} className="text-xs text-emerald hover:underline dark:text-mint">
                                                    {member.email}
                                                </Link>
                                            </td>
                                            <td className="px-4 py-3">{t(`community.genders.${member.gender}`)}</td>
                                            <td className="px-4 py-3">
                                                <Badge tone={STATUS_TONES[member.status]}>{t(`community.statuses.${member.status}`)}</Badge>
                                            </td>
                                            <td className="hidden px-4 py-3 md:table-cell">{date(member.joined_at)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex flex-wrap gap-1.5">
                                                    {member.status === 'active' ? (
                                                        <Button
                                                            variant="secondary"
                                                            loading={busy === `${member.id}:suspend`}
                                                            onClick={() => run(member, 'suspend', t('community.confirmSuspend'))}>
                                                            {t('community.suspend')}
                                                        </Button>
                                                    ) : null}
                                                    {member.status !== 'banned' ? (
                                                        <Button
                                                            variant="danger"
                                                            loading={busy === `${member.id}:ban`}
                                                            onClick={() => run(member, 'ban', t('community.confirmBan'))}>
                                                            {t('community.ban')}
                                                        </Button>
                                                    ) : null}
                                                    {member.status === 'suspended' || member.status === 'banned' ? (
                                                        <Button
                                                            variant="secondary"
                                                            loading={busy === `${member.id}:reactivate`}
                                                            onClick={() => run(member, 'reactivate')}>
                                                            {t('community.reactivate')}
                                                        </Button>
                                                    ) : null}
                                                    <Button
                                                        variant="ghost"
                                                        loading={busy === `${member.id}:gender`}
                                                        onClick={() =>
                                                            run(
                                                                member,
                                                                'gender',
                                                                t('community.confirmGender', { gender: t(`community.genders.${otherGender(member)}`) }),
                                                                { gender: otherGender(member) },
                                                            )
                                                        }>
                                                        {t('community.changeGender')}
                                                    </Button>
                                                </div>
                                            </td>
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
                    <Button variant="secondary" disabled={page <= 1} onClick={() => update({ page: String(page - 1) })}>
                        {t('previous')}
                    </Button>
                    <span className="text-sm text-ink-soft dark:text-night-ink-soft">
                        {t('pageOf', { page: number(data.page), pages: number(data.pagesCount) })}
                    </span>
                    <Button variant="secondary" disabled={page >= data.pagesCount} onClick={() => update({ page: String(page + 1) })}>
                        {t('next')}
                    </Button>
                </div>
            ) : null}
        </div>
    );
}
