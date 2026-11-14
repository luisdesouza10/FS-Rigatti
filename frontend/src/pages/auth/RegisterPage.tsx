import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowRight, Building2, Lock, Mail, MailCheck, User } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, Input, PasswordInput } from '../../components/ui/Field';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { AuthLayout } from './AuthLayout';

const schema = z.object({
  companyName: z.string().trim().min(2, 'Nome da empresa muito curto'),
  name: z.string().trim().min(2, 'Informe seu nome'),
  email: z.email('Informe um e-mail válido'),
  password: z
    .string()
    .min(8, 'Mínimo de 8 caracteres')
    .refine((v) => v.trim().length >= 8, 'Mínimo de 8 caracteres visíveis')
    // bcrypt ignores everything past 72 bytes; the API rejects longer passwords.
    .refine((v) => new TextEncoder().encode(v).length <= 72, 'Máximo de 72 bytes (cerca de 72 letras sem acento)'),
});
type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const { register: registerCompany } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  // The account only exists after the e-mail is confirmed (link sent by e-mail).
  const [sent, setSent] = useState<{ email: string; message: string } | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const message = await registerCompany(values);
      setSent({ email: values.email, message });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta');
    }
  });

  if (sent) {
    return (
      <AuthLayout title="Confira seu e-mail" subtitle={<>Já confirmou? <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">Entrar</Link></>}>
        <div className="space-y-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
            <MailCheck className="h-6 w-6" />
          </span>
          <p className="text-sm text-stone-600 dark:text-stone-300">{sent.message}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            O link vale 24 horas. A empresa e a sua conta só são criadas depois que você confirmar. Não chegou? Veja o spam ou
            cadastre de novo: o link anterior deixa de valer.
          </p>
          <Button variant="secondary" className="w-full" onClick={() => setSent(null)}>
            Usar outro e-mail
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Cadastre sua empresa"
      subtitle={
        <>
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome da empresa" htmlFor="companyName" error={errors.companyName?.message}>
          <Input id="companyName" placeholder="Minha Loja Ltda." icon={<Building2 />} invalid={!!errors.companyName} {...register('companyName')} />
        </Field>
        <Field label="Seu nome" htmlFor="name" error={errors.name?.message}>
          <Input id="name" autoComplete="name" placeholder="Maria Silva" icon={<User />} invalid={!!errors.name} {...register('name')} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={errors.email?.message}>
          <Input id="email" type="email" autoComplete="email" placeholder="voce@empresa.com" icon={<Mail />} invalid={!!errors.email} {...register('email')} />
        </Field>
        <Field label="Senha" htmlFor="password" error={errors.password?.message} hint="Mínimo de 8 caracteres">
          <PasswordInput id="password" autoComplete="new-password" placeholder="••••••••" icon={<Lock />} invalid={!!errors.password} {...register('password')} />
        </Field>

        {formError && (
          <p role="alert" className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            {formError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Criar conta <ArrowRight className="h-4 w-4" />
        </Button>
        <p className="text-center text-xs text-stone-500 dark:text-stone-400">
          Você será o administrador da empresa e poderá convidar sua equipe.
        </p>
      </form>
    </AuthLayout>
  );
}
