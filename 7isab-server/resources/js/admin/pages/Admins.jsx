import { useCallback, useEffect, useState } from 'react';

import { api } from '../api';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Field, Spinner } from '../ui';

const EMPTY = { id: null, name: '', email: '', password: '', role: 'admin', is_active: true };

/** Admin accounts (super admins only). */
export default function Admins() {
    const { t, date } = useI18n();
    const { user: me } = useAuth();
    const [items, setItems] = useState(null);
    const [form, setForm] = useState(null);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        api('/admins', { query: { pageSize: 100 } })
            .then((data) => setItems(data.items))
            .catch(() => setItems([]));
    }, []);

    useEffect(load, [load]);

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        setErrors({});
        const body = { name: form.name || null, email: form.email, role: form.role, is_active: form.is_active };
        if (form.password) body.password = form.password;
        try {
            await api(form.id ? `/admins/${form.id}` : '/admins', { method: form.id ? 'PUT' : 'POST', body });
            setForm(null);
            load();
        } catch (failure) {
            setErrors(Object.keys(failure.errors ?? {}).length ? failure.errors : { email: failure.message || t('error') });
        } finally {
            setSaving(false);
        }
    };

    const remove = async (admin) => {
        if (!window.confirm(t('confirmDelete'))) return;
        await api(`/admins/${admin.id}`, { method: 'DELETE' }).catch(() => undefined);
        load();
    };

    const first = (value) => (Array.isArray(value) ? value[0] : value);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">{t('admins')}</h1>
                <Button onClick={() => setForm({ ...EMPTY })}>{t('addAdmin')}</Button>
            </div>

            {form ? (
                <Card>
                    <form className="grid grid-cols-1 gap-4 sm:grid-cols-2" onSubmit={save}>
                        <h2 className="font-semibold sm:col-span-2">{form.id ? t('editAdmin') : t('addAdmin')}</h2>
                        <Field label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={first(errors.name)} />
                        <Field
                            label={t('email')}
                            type="email"
                            required
                            value={form.email}
                            onChange={(e) => setForm({ ...form, email: e.target.value })}
                            error={first(errors.email)}
                        />
                        <Field
                            label={form.id ? t('newPassword') : t('password')}
                            type="password"
                            required={!form.id}
                            minLength={8}
                            value={form.password}
                            onChange={(e) => setForm({ ...form, password: e.target.value })}
                            error={first(errors.password)}
                        />
                        <label className="block space-y-1.5">
                            <span className="text-sm font-medium text-ink-soft dark:text-night-ink-soft">{t('role')}</span>
                            <select
                                value={form.role}
                                onChange={(e) => setForm({ ...form, role: e.target.value })}
                                className="w-full rounded-xl border-2 border-line bg-white px-4 py-2.5 dark:border-night-line dark:bg-night">
                                <option value="admin">{t('roles.admin')}</option>
                                <option value="super-admin">{t('roles.super-admin')}</option>
                            </select>
                            {errors.role ? <span className="text-xs text-danger">{first(errors.role)}</span> : null}
                        </label>
                        {form.id ? (
                            <label className="flex items-center gap-2 text-sm">
                                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
                                {t('active')}
                            </label>
                        ) : null}
                        <div className="flex gap-2 sm:col-span-2">
                            <Button type="submit" loading={saving}>
                                {t('save')}
                            </Button>
                            <Button type="button" variant="ghost" onClick={() => setForm(null)}>
                                {t('cancel')}
                            </Button>
                        </div>
                    </form>
                </Card>
            ) : null}

            {!items ? <Spinner /> : null}
            {items ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {items.map((admin) => (
                        <Card key={admin.id} className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold break-all">{admin.email}</span>
                                <Badge tone={admin.role === 'super-admin' ? 'gold' : 'emerald'}>{t(`roles.${admin.role}`)}</Badge>
                                {!admin.is_active ? <Badge tone="danger">{t('inactive')}</Badge> : null}
                                {admin.id === me?.id ? <Badge>{t('you')}</Badge> : null}
                            </div>
                            <div className="text-xs text-ink-soft dark:text-night-ink-soft">
                                {admin.name ? `${admin.name} · ` : ''}
                                {t('lastLogin')}: {date(admin.last_login_at)}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setForm({ ...EMPTY, ...admin, name: admin.name ?? '', password: '' })}>
                                    {t('editAdmin')}
                                </Button>
                                {admin.id !== me?.id ? (
                                    <Button variant="danger" onClick={() => remove(admin)}>
                                        {t('delete')}
                                    </Button>
                                ) : null}
                            </div>
                        </Card>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
