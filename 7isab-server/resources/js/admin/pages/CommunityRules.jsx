import { useCallback, useEffect, useState } from 'react';

import { api } from '../api';
import { useI18n } from '../i18n';
import { Badge, Button, Card, Field, Spinner } from '../ui';

const LANGS = ['ar', 'en', 'fr'];
const EMPTY = { key: '', order: '', texts: { ar: '', en: '', fr: '' }, changed: false };

/**
 * Community rules, shown one by one when joining. A change in substance makes a
 * new version that every member must accept again; a wording fix doesn't.
 */
export default function CommunityRules() {
    const { t, number } = useI18n();
    const [rules, setRules] = useState(null);
    const [error, setError] = useState(false);
    const [editing, setEditing] = useState(null); // rule id, 'new' or null

    const load = useCallback(() => {
        api('/community/rules')
            .then((data) => setRules(data.items))
            .catch(() => setError(true));
    }, []);

    useEffect(load, [load]);

    const remove = async (rule) => {
        if (!window.confirm(t('community.confirmDeleteRule'))) return;
        try {
            await api(`/community/rules/${rule.id}`, { method: 'DELETE' });
            load();
        } catch {
            setError(true);
        }
    };

    if (error) return <p className="text-danger">{t('error')}</p>;
    if (!rules) return <Spinner />;

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="text-2xl font-bold">{t('community.rules')}</h1>
                {editing === null ? <Button onClick={() => setEditing('new')}>{t('community.addRule')}</Button> : null}
            </div>
            <p className="rounded-xl bg-emerald-soft p-4 text-sm text-emerald dark:bg-night-muted dark:text-mint">{t('community.rulesHint')}</p>

            {editing === 'new' ? (
                <RuleForm
                    onCancel={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        load();
                    }}
                />
            ) : null}

            {rules.length === 0 ? <p className="text-ink-soft dark:text-night-ink-soft">{t('noResults')}</p> : null}

            {rules.map((rule) =>
                editing === rule.id ? (
                    <RuleForm
                        key={rule.id}
                        rule={rule}
                        onCancel={() => setEditing(null)}
                        onSaved={() => {
                            setEditing(null);
                            load();
                        }}
                    />
                ) : (
                    <Card key={rule.id} className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm font-semibold">{rule.key}</span>
                            <Badge tone="gold">{t('community.versionN', { version: number(rule.version) })}</Badge>
                            <span className="text-xs text-ink-soft dark:text-night-ink-soft">{t('community.orderN', { order: number(rule.order) })}</span>
                        </div>
                        <dl className="space-y-2 text-sm">
                            {LANGS.map((lang) => (
                                <div key={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                                    <dt className="text-xs uppercase text-ink-soft dark:text-night-ink-soft">{lang}</dt>
                                    <dd>{rule.texts?.[lang]}</dd>
                                </div>
                            ))}
                        </dl>
                        {editing === null ? (
                            <div className="flex gap-2">
                                <Button variant="secondary" onClick={() => setEditing(rule.id)}>
                                    {t('community.edit')}
                                </Button>
                                <Button variant="danger" onClick={() => remove(rule)}>
                                    {t('delete')}
                                </Button>
                            </div>
                        ) : null}
                    </Card>
                ),
            )}
        </div>
    );
}

function RuleForm({ rule, onCancel, onSaved }) {
    const { t } = useI18n();
    const [form, setForm] = useState(() => (rule ? { ...EMPTY, ...rule, order: String(rule.order), texts: { ...EMPTY.texts, ...rule.texts } } : EMPTY));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);

    const setText = (lang, value) => setForm((current) => ({ ...current, texts: { ...current.texts, [lang]: value } }));

    const save = async (event) => {
        event.preventDefault();
        setSaving(true);
        setErrors({});
        const order = form.order === '' ? undefined : Number(form.order);
        try {
            if (rule) {
                await api(`/community/rules/${rule.id}`, { method: 'PUT', body: { texts: form.texts, order, changed: form.changed } });
            } else {
                await api('/community/rules', { method: 'POST', body: { key: form.key, texts: form.texts, order } });
            }
            onSaved();
        } catch (error) {
            setErrors(Object.keys(error.errors ?? {}).length ? error.errors : { form: t('error') });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card>
            <form onSubmit={save} className="space-y-4">
                <h2 className="font-semibold">{rule ? t('community.editRule') : t('community.addRule')}</h2>
                {rule ? null : (
                    <Field
                        label={t('community.key')}
                        value={form.key}
                        onChange={(event) => setForm({ ...form, key: event.target.value })}
                        placeholder="kind_words"
                        error={errors.key}
                        required
                    />
                )}
                {LANGS.map((lang) => (
                    <label key={lang} className="block space-y-1.5">
                        <span className="text-sm font-medium text-ink-soft dark:text-night-ink-soft">{t(`community.text_${lang}`)}</span>
                        <textarea
                            dir={lang === 'ar' ? 'rtl' : 'ltr'}
                            rows={3}
                            value={form.texts[lang]}
                            onChange={(event) => setText(lang, event.target.value)}
                            required
                            className="w-full rounded-xl border-2 border-line bg-white px-4 py-2.5 outline-none focus:border-emerald dark:border-night-line dark:bg-night dark:focus:border-mint"
                        />
                        {errors[`texts.${lang}`] ? <span className="text-xs text-danger">{errors[`texts.${lang}`]}</span> : null}
                    </label>
                ))}
                <Field
                    label={t('community.order')}
                    type="number"
                    min="0"
                    value={form.order}
                    onChange={(event) => setForm({ ...form, order: event.target.value })}
                    error={errors.order}
                />
                {rule ? (
                    <label className="flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            className="mt-1 size-4 accent-emerald"
                            checked={form.changed}
                            onChange={(event) => setForm({ ...form, changed: event.target.checked })}
                        />
                        <span>{t('community.changedInSubstance')}</span>
                    </label>
                ) : null}
                {errors.form ? <p className="text-sm text-danger">{errors.form}</p> : null}
                <div className="flex gap-2">
                    <Button type="submit" loading={saving}>
                        {t('save')}
                    </Button>
                    <Button type="button" variant="ghost" onClick={onCancel}>
                        {t('cancel')}
                    </Button>
                </div>
            </form>
        </Card>
    );
}
