import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Lock, Mail, ShieldCheck, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, Input, PasswordInput } from '../../components/ui/Field';
import { Avatar } from '../../components/ui/misc';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  email: z.email('Informe um e-mail válido'),
  password: z.string().min(1, 'Informe a senha'),
});
type FormValues = z.infer<typeof schema>;

const DEMO_ACCOUNTS = [
  { company: 'TechNova', role: 'admin', email: 'admin@technova.com' },
  { company: 'TechNova', role: 'cliente', email: 'user@technova.com' },
  { company: 'Casa Bella', role: 'admin', email: 'admin@casabella.com' },
  { company: 'Casa Bella', role: 'cliente', email: 'user@casabella.com' },
] as const;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });
  const currentEmail = watch('email');

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    try {
      await login(email, password);
      void navigate((location.state as { from?: string } | null)?.from ?? '/products', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível entrar');
    }
  });

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle={
        <>
          Não tem conta?{' '}
          <Link to="/register" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">
            Cadastre sua empresa
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="voce@empresa.com" icon={<Mail />} invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message}>
          <PasswordInput id="password" autoComplete="current-password" placeholder="••••••••" icon={<Lock />} invalid={!!errors.password} {...register('password')} />
        </Field>

        {formError && (
          <p role="alert" className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Entrar <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="my-8 flex items-center gap-3 text-xs font-medium text-stone-400">
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
        ou entre com uma conta de demonstração
        <span className="h-px flex-1 bg-stone-200 dark:bg-stone-800" />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {DEMO_ACCOUNTS.map((acc) => {
          const selected = currentEmail === acc.email;
          return (
            <button
              key={acc.email}
              type="button"
              onClick={() => {
                setValue('email', acc.email, { shouldValidate: true });
                setValue('password', 'senha123', { shouldValidate: true });
              }}
              className={
                'group flex items-center gap-2.5 rounded-2xl border bg-white p-2.5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-lift dark:bg-stone-900 ' +
                (selected
                  ? 'border-brand-500 ring-4 ring-brand-500/15 dark:border-brand-400'
                  : 'border-stone-200 hover:border-stone-300 dark:border-stone-800 dark:hover:border-stone-700')
              }
            >
              <Avatar name={acc.company} size="sm" className="ring-0" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[13px] font-semibold">{acc.company}</span>
                <span className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
                  {acc.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                  {acc.role === 'admin' ? 'Administrador' : 'Cliente'}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">
        Senha de todas as contas: <code className="rounded-md bg-stone-100 px-1.5 py-0.5 font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-300">senha123</code>
      </p>
    </AuthLayout>
  );
}
