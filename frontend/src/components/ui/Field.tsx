import clsx from 'clsx';
import { Eye, EyeOff } from 'lucide-react';
import {
  forwardRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';

const control =
  'block w-full rounded-xl border bg-white px-3.5 text-sm text-stone-900 shadow-[0_1px_2px_rgb(8_50_59/0.04)] transition placeholder:text-stone-400 ' +
  'hover:border-stone-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15 focus:outline-none ' +
  'disabled:cursor-not-allowed disabled:opacity-60 dark:bg-stone-900 dark:text-stone-100 dark:placeholder:text-stone-500 dark:hover:border-stone-600 dark:focus:border-brand-400 dark:focus:ring-brand-400/20';

const border = (invalid?: boolean) =>
  invalid ? 'border-red-400 focus:border-red-500 focus:ring-red-500/15 dark:border-red-500/70' : 'border-stone-200 dark:border-stone-700';

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({ label, htmlFor, error, hint, children, className }: Readonly<FieldProps>) {
  return (
    <div className={clsx('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="block text-sm font-semibold text-stone-700 dark:text-stone-300">
        {label}
      </label>
      {children}
      {error && (
        <p role="alert" className="animate-fade-in text-xs font-medium text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {!error && hint && <p className="text-xs text-stone-500 dark:text-stone-400">{hint}</p>}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; icon?: ReactNode; trailing?: ReactNode };

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ className, invalid, icon, trailing, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={clsx(control, border(invalid), 'h-11', icon && 'pl-10', trailing && 'pr-11', className)}
      {...props}
    />
  );
  if (!icon && !trailing) return input;
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>
      )}
      {input}
      {trailing && <span className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</span>}
    </div>
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputProps, 'type' | 'trailing'>>(function PasswordInput(props, ref) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      ref={ref}
      type={visible ? 'text' : 'password'}
      {...props}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 transition hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-stone-800 dark:hover:text-stone-200"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      }
    />
  );
});

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean };

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ className, invalid, ...props }, ref) {
  return (
    <textarea ref={ref} aria-invalid={invalid || undefined} className={clsx(control, border(invalid), 'py-3', className)} {...props} />
  );
});

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean };

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select({ className, invalid, ...props }, ref) {
  return <select ref={ref} className={clsx(control, border(invalid), 'h-11 pr-9', className)} {...props} />;
});
