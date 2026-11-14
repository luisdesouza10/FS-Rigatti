import clsx from 'clsx';
import { Sparkles } from 'lucide-react';

export function AssistantAvatar({ className }: Readonly<{ className?: string }>) {
  return (
    <span
      aria-hidden
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-800 text-white shadow-glow',
        className ?? 'h-8 w-8',
      )}
    >
      <Sparkles className="h-[45%] w-[45%] text-accent-200" />
    </span>
  );
}
