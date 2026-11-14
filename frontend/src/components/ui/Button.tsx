import clsx from 'clsx';
import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse' | 'glass';
type Size = 'sm' | 'md' | 'lg' | 'icon';

const variants: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-brand-500 to-brand-600 font-semibold text-white shadow-glow ring-1 ring-brand-700/40 ring-inset ' +
    'hover:from-brand-600 hover:to-brand-700 active:translate-y-px disabled:opacity-55 disabled:shadow-none ' +
    'dark:from-brand-400 dark:to-brand-500 dark:hover:from-brand-500 dark:hover:to-brand-600',
  secondary:
    'border border-stone-200 bg-white font-semibold text-stone-800 shadow-card hover:border-stone-300 hover:bg-stone-50 ' +
    'dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 dark:hover:bg-stone-800',
  ghost: 'text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100',
  danger: 'bg-red-600 font-semibold text-white shadow-sm hover:bg-red-500 active:bg-red-700 disabled:bg-red-600/60',
  inverse: 'bg-white font-semibold text-brand-800 shadow-lg shadow-black/10 hover:bg-brand-50',
  glass: 'bg-white/10 font-semibold text-white ring-1 ring-white/20 ring-inset backdrop-blur hover:bg-white/20',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 gap-1.5 rounded-xl px-3.5 text-sm',
  md: 'h-11 gap-2 rounded-xl px-5 text-sm',
  lg: 'h-12 gap-2 rounded-2xl px-6 text-[15px]',
  icon: 'h-9 w-9 rounded-xl',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, icon, className, children, disabled, ...props }: Readonly<ButtonProps>) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-all duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
