import { zodResolver } from '@hookform/resolvers/zod';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '../../components/ui/Button';
import { Field, Input, PasswordInput } from '../../components/ui/Field';
import { Skeleton } from '../../components/ui/misc';
import { useAuth } from '../../context/AuthContext';
import { ApiError, api } from '../../lib/api';
import { AuthLayout } from './AuthLayout';

const schema = z
  .object({
    password: z
      .string()
      .min(8, 'Mínimo de 8 caracteres')
      .refine((v) => v.trim().length >= 8, 'Mínimo de 8 caracteres visíveis')
      // bcrypt ignores everything past 72 bytes; the API rejects longer passwords.
      .refine((v) => new TextEncoder().encode(v).length <= 72, 'Máximo de 72 bytes (cerca de 72 letras sem acento)'),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' });
type FormValues = z.infer<typeof schema>;

interface InviteInfo {
  companyName: string;
  email: string;
  name: string;
}

const linkClass = 'font-semibold text-brand-700 underline-offset-4 hover:underline dark:text-brand-300';

export function AcceptInvitePage() {
  const { token = '' } = useParams();
  const { user, acceptInvite } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const info = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api<InviteInfo>(`/auth/invites/${encodeURIComponent(token)}`),
    retry: false,
  });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = handleSubmit(async ({ password }) => {
    setFormError(null);
    try {
      await acceptInvite(token, password);
      toast.success(`Bem-vindo à ${info.data?.companyName ?? 'equipe'}!`);
      void navigate('/products', { replace: true });
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível aceitar o convite');
    }
  });

  if (info.isError) {
    return (
      <AuthLayout title="Convite indisponível" subtitle={<>Já tem conta? <Link to="/login" className={linkClass}>Entrar</Link></>}>
        <p className="text-sm text-stone-600 dark:text-stone-400">
          Este convite não existe, já foi usado ou expirou (os convites valem 7 dias). Peça um novo link a quem convidou você.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={info.data ? `Entre na equipe da ${info.data.companyName}` : 'Convite'}
      subtitle={info.data ? `Olá, ${info.data.name}! Crie sua senha para começar.` : 'Carregando convite…'}
    >
      {info.isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      ) : (
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <Field label="E-mail" htmlFor="invite-email">
            <Input id="invite-email" type="email" value={info.data?.email ?? ''} readOnly icon={<Mail />} />
          </Field>
          <Field label="Senha" htmlFor="invite-password" error={errors.password?.message} hint="Mínimo de 8 caracteres">
            <PasswordInput id="invite-password" autoComplete="new-password" placeholder="••••••••" icon={<Lock />} invalid={!!errors.password} {...register('password')} />
          </Field>
          <Field label="Confirme a senha" htmlFor="invite-confirm" error={errors.confirm?.message}>
            <PasswordInput id="invite-confirm" autoComplete="new-password" placeholder="••••••••" icon={<Lock />} invalid={!!errors.confirm} {...register('confirm')} />
          </Field>

          {formError && (
            <p role="alert" className="animate-fade-in rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
              {formError}
            </p>
          )}

          <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
            Aceitar convite <ArrowRight className="h-4 w-4" />
          </Button>
          {user && (
            <p className="text-center text-xs text-stone-500 dark:text-stone-400">
              Você está conectado como {user.email}. Ao aceitar, entra com a nova conta.
            </p>
          )}
        </form>
      )}
    </AuthLayout>
  );
}
