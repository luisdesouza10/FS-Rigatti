import clsx from 'clsx';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { Button } from './Button';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, description, icon, children, footer, size = 'lg' }: Readonly<ModalProps>) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    // A click on the backdrop (outside the content) closes; the keyboard equivalent is Escape (onCancel).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog // NOSONAR: same reason as above (Escape is the keyboard path)
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className={clsx(
        'm-auto w-[calc(100%-2rem)] overflow-hidden rounded-3xl border border-stone-200/80 bg-white p-0 text-stone-900 shadow-2xl shadow-brand-950/20',
        'backdrop:bg-stone-950/45 backdrop:backdrop-blur-sm open:animate-slide-up',
        'dark:border-stone-800 dark:bg-stone-900 dark:text-stone-100',
        size === 'sm' && 'max-w-md',
        size === 'lg' && 'max-w-2xl',
        size === 'xl' && 'max-w-4xl',
      )}
    >
      {open && (
        <div className="flex max-h-[min(90dvh,800px)] flex-col">
          <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-4">
            <div className="flex items-start gap-3">
              {icon && (
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                  {icon}
                </span>
              )}
              <div>
                <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
                {description && <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">{description}</p>}
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar" icon={<X className="h-4 w-4" />} />
          </header>
          <div className="scroll-thin overflow-y-auto px-6 pb-6">{children}</div>
          {footer && (
            <footer className="flex justify-end gap-2 border-t border-stone-100 bg-stone-50/80 px-6 py-4 dark:border-stone-800 dark:bg-stone-950/40">
              {footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
