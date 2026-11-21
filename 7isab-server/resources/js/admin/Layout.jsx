import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router';

import { useAuth } from './auth';
import { LANGUAGES, useI18n } from './i18n';
import { Logo, cx } from './ui';

const THEME_KEY = 'hisab.admin.theme';

function useThemeToggle() {
    const [dark, setDark] = useState(() => {
        try {
            const stored = localStorage.getItem(THEME_KEY);
            if (stored) return stored === 'dark';
        } catch {
            // Storage blocked.
        }
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    });

    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        try {
            localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
        } catch {
            // Storage blocked.
        }
    }, [dark]);

    return [dark, setDark];
}

export function Preferences({ className }) {
    const { lang, setLang, t } = useI18n();
    const [dark, setDark] = useThemeToggle();

    return (
        <div className={cx('flex items-center gap-2', className)}>
            <select
                aria-label={t('language')}
                value={lang}
                onChange={(event) => setLang(event.target.value)}
                className="rounded-lg border border-white/20 bg-white/10 px-2 py-1.5 text-sm text-white outline-none">
                {LANGUAGES.map((item) => (
                    <option key={item.code} value={item.code} className="text-ink">
                        {item.label}
                    </option>
                ))}
            </select>
            <button
                type="button"
                aria-label={t('theme')}
                onClick={() => setDark((value) => !value)}
                className="rounded-lg border border-white/20 bg-white/10 px-2.5 py-1.5 text-sm text-white">
                {dark ? '☀' : '☾'}
            </button>
        </div>
    );
}

export default function Layout() {
    const { user, signOut, isSuperAdmin } = useAuth();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);

    const links = [
        { to: '/admin', label: t('dashboard'), end: true },
        { to: '/admin/users', label: t('users') },
        { to: '/admin/community/members', label: t('community.members') },
        { to: '/admin/community/rules', label: t('community.rules') },
        { to: '/admin/community/space-requests', label: t('spaces.requests') },
        { to: '/admin/community/spaces', label: t('spaces.title') },
        { to: '/admin/community/reports', label: t('reports.title') },
        { to: '/admin/community/shaykhs', label: t('shaykhs.title') },
        ...(isSuperAdmin ? [{ to: '/admin/admins', label: t('admins') }] : []),
    ];

    const nav = (
        <nav className="flex flex-col gap-1">
            {links.map((link) => (
                <NavLink
                    key={link.to}
                    to={link.to}
                    end={link.end}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                        cx(
                            'rounded-xl px-4 py-2.5 text-sm font-medium transition',
                            isActive ? 'bg-white/15 text-white' : 'text-white/75 hover:bg-white/10 hover:text-white',
                        )
                    }>
                    {link.label}
                </NavLink>
            ))}
        </nav>
    );

    return (
        <div className="min-h-screen lg:flex">
            <aside
                className={cx(
                    'pattern fixed inset-y-0 start-0 z-30 flex w-64 flex-col gap-6 bg-emerald p-5 text-white transition-transform dark:bg-[#10392d] lg:static lg:translate-x-0',
                    open ? 'translate-x-0' : 'ltr:-translate-x-full rtl:translate-x-full',
                )}>
                <div className="flex items-center gap-3">
                    <Logo />
                    <div>
                        <div className="text-lg font-bold">{t('appName')}</div>
                        <div className="text-xs text-gold-soft">{t('admin')}</div>
                    </div>
                </div>
                {nav}
                <div className="mt-auto space-y-3">
                    <Preferences />
                    <div className="text-xs text-white/70">
                        {user?.email} · {t(`roles.${user?.role}`)}
                    </div>
                    <button type="button" onClick={signOut} className="text-sm font-semibold text-gold-soft hover:text-white">
                        {t('signOut')}
                    </button>
                </div>
            </aside>
            {open ? <div className="fixed inset-0 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} /> : null}

            <div className="flex-1">
                <header className="pattern flex items-center gap-3 bg-emerald px-4 py-3 text-white dark:bg-[#10392d] lg:hidden">
                    <button type="button" aria-label="Menu" onClick={() => setOpen(true)} className="rounded-lg p-2 hover:bg-white/10">
                        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
                        </svg>
                    </button>
                    <Logo className="size-7" />
                    <span className="font-bold">{t('appName')}</span>
                </header>
                <main className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
