/** Small shared UI pieces for the admin panel. */

export function cx(...classes) {
    return classes.filter(Boolean).join(' ');
}

export function Card({ className, children }) {
    return (
        <div className={cx('rounded-2xl border border-line bg-white p-5 shadow-sm dark:border-night-line dark:bg-night-surface', className)}>
            {children}
        </div>
    );
}

const BUTTONS = {
    primary: 'bg-emerald text-white hover:bg-emerald-dark dark:bg-mint dark:text-night',
    secondary: 'bg-emerald-soft text-emerald hover:bg-line dark:bg-night-muted dark:text-mint',
    danger: 'bg-danger-soft text-danger hover:bg-danger hover:text-white dark:bg-night-muted',
    ghost: 'text-emerald hover:bg-emerald-soft dark:text-mint dark:hover:bg-night-muted',
};

export function Button({ variant = 'primary', className, loading, children, ...rest }) {
    return (
        <button
            className={cx(
                'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:opacity-50',
                BUTTONS[variant],
                className,
            )}
            disabled={loading || rest.disabled}
            {...rest}>
            {loading ? <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null}
            {children}
        </button>
    );
}

export function Field({ label, error, ...rest }) {
    return (
        <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink-soft dark:text-night-ink-soft">{label}</span>
            <input
                className={cx(
                    'w-full rounded-xl border-2 bg-white px-4 py-2.5 outline-none transition focus:border-emerald dark:bg-night dark:focus:border-mint',
                    error ? 'border-danger' : 'border-line dark:border-night-line',
                )}
                {...rest}
            />
            {error ? <span className="text-xs text-danger">{error}</span> : null}
        </label>
    );
}

export function Badge({ tone = 'emerald', children }) {
    const tones = {
        emerald: 'bg-emerald-soft text-emerald dark:bg-night-muted dark:text-mint',
        gold: 'bg-gold-soft text-[#7a5f10] dark:bg-night-muted dark:text-gold',
        danger: 'bg-danger-soft text-danger dark:bg-night-muted',
    };
    return <span className={cx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tones[tone])}>{children}</span>;
}

export function Spinner() {
    return (
        <div className="flex justify-center py-12">
            <span className="size-8 animate-spin rounded-full border-4 border-emerald border-t-transparent dark:border-mint dark:border-t-transparent" />
        </div>
    );
}

/** Eight-point star logo mark. */
export function Logo({ className = 'size-9' }) {
    return (
        <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
            <path
                fill="#C9A227"
                d="M20 2l5 8.3 9.5-2.6-2.6 9.5L40 20l-8.1 4.8 2.6 9.5-9.5-2.6L20 40l-5-8.3-9.5 2.6 2.6-9.5L0 20l8.1-4.8-2.6-9.5 9.5 2.6z"
            />
            <circle cx="20" cy="20" r="8" fill="none" stroke="#0F5C45" strokeWidth="2.5" />
        </svg>
    );
}
