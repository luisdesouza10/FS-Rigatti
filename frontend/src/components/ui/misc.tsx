import clsx from 'clsx';
import type { ReactNode } from 'react';
import { initials } from '../../lib/format';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: Readonly<{
  children: ReactNode;
  tone?: 'neutral' | 'brand' | 'success' | 'accent';
  className?: string;
}>) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold',
        tone === 'neutral' && 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
        tone === 'brand' && 'bg-brand-50 text-brand-700 ring-1 ring-brand-600/15 ring-inset dark:bg-brand-500/15 dark:text-brand-300',
        tone === 'success' && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
        tone === 'accent' && 'bg-accent-50 text-accent-600 ring-1 ring-accent-500/20 ring-inset dark:bg-accent-500/15 dark:text-accent-300',
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Skeleton({ className }: Readonly<{ className?: string }>) {
  return <div className={clsx('animate-pulse rounded-xl bg-stone-200/70 dark:bg-stone-800', className)} />;
}

export function EmptyState({ icon, title, description, action }: Readonly<{ icon: ReactNode; title: string; description?: string; action?: ReactNode }>) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border border-dashed border-stone-300 bg-white px-6 py-20 text-center dark:border-stone-700 dark:bg-stone-900">
      <div className="bg-dots mask-radial pointer-events-none absolute inset-0 text-stone-200 dark:text-stone-800" />
      <div className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 text-brand-600 ring-1 ring-brand-200 dark:from-brand-500/15 dark:to-brand-500/5 dark:text-brand-300 dark:ring-brand-500/20">
        {icon}
      </div>
      <h3 className="relative font-display text-lg font-bold">{title}</h3>
      {description && <p className="relative mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      {action && <div className="relative mt-6">{action}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  eyebrow,
  count,
  description,
  actions,
}: Readonly<{
  title: string;
  eyebrow?: ReactNode;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
}>) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="mb-1 text-sm font-semibold text-brand-600 dark:text-brand-400">{eyebrow}</p>}
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
          {count != null && <span className="ml-2 text-xl font-medium text-stone-400">{count}</span>}
        </h1>
        {description && <p className="mt-1.5 text-sm text-stone-500 dark:text-stone-400">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Brand mark: a shopping bag with a spark. */
export function LogoMark({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      className={clsx(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-900 text-white shadow-glow',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="h-[70%] w-[70%]" aria-hidden>
        <path d="M8 10.5h16l-1.6 12.2a2 2 0 0 1-2 1.8h-8.8a2 2 0 0 1-2-1.8z" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" />
        <path d="M12.5 10.5V9a3.5 3.5 0 0 1 7 0v1.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16 13.8l1 2.3 2.3 1-2.3 1-1 2.3-1-2.3-2.3-1 2.3-1z" className="fill-accent-300" />
      </svg>
    </span>
  );
}

export function Logo({ className, inverted }: Readonly<{ className?: string; inverted?: boolean }>) {
  return (
    <div className={clsx('flex items-center gap-2.5', className)}>
      <LogoMark />
      <span
        className={clsx(
          'font-display text-xl font-bold tracking-tight',
          inverted ? 'text-white' : 'text-stone-900 dark:text-white',
        )}
      >
        vitrine
        <span className={clsx('ml-0.5', inverted ? 'text-accent-300' : 'text-brand-600 dark:text-brand-300')}>ia</span>
      </span>
    </div>
  );
}

const AVATAR_TONES = [
  'from-brand-400 to-brand-700',
  'from-accent-300 to-accent-600',
  'from-emerald-400 to-teal-700',
  'from-sky-400 to-indigo-600',
  'from-rose-400 to-fuchsia-600',
  'from-amber-300 to-orange-600',
];

function toneFor(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

export function Avatar({ name, size = 'md', className }: Readonly<{ name: string; size?: 'sm' | 'md' | 'lg'; className?: string }>) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white ring-2 ring-white dark:ring-stone-900',
        toneFor(name),
        size === 'sm' && 'h-8 w-8 text-[11px]',
        size === 'md' && 'h-10 w-10 text-sm',
        size === 'lg' && 'h-12 w-12 text-base',
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
