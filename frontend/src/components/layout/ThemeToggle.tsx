import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { useTheme, type Theme } from '../../context/ThemeContext';

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Escuro', icon: Moon },
];

export function ThemeToggle({ className, showLabels }: Readonly<{ className?: string; showLabels?: boolean }>) {
  const { theme, setTheme } = useTheme();
  return (
    <div
      role="radiogroup"
      aria-label="Tema"
      className={clsx('inline-flex rounded-xl bg-stone-100 p-1 ring-1 ring-stone-200/60 ring-inset dark:bg-stone-800/80 dark:ring-stone-700/50', className)}
    >
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => setTheme(value)}
          className={clsx(
            'flex h-7 flex-1 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition',
            theme === value
              ? 'bg-white text-stone-900 shadow-card dark:bg-stone-950 dark:text-stone-100'
              : 'text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className={showLabels ? undefined : 'sr-only'}>{label}</span>
        </button>
      ))}
    </div>
  );
}
