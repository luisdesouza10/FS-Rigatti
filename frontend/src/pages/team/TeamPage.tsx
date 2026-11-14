import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Clock, KeyRound, Mail, RefreshCw, Send, ShieldCheck, Trash2, User as UserIcon, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { ChangePasswordModal } from '../../components/layout/ChangePasswordModal';
import { Button } from '../../components/ui/Button';
import { Field, Input, Select } from '../../components/ui/Field';
import { Modal } from '../../components/ui/Modal';
import { Avatar, Badge, PageHeader, Skeleton } from '../../components/ui/misc';
import { useAuth } from '../../context/AuthContext';
import { ApiError, api } from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { Invitation, InviteResult, Role, User } from '../../lib/types';

const schema = z.object({
  name: z.string().trim().min(2, 'Informe o nome'),
  email: z.email('E-mail inválido'),
  role: z.enum(['user', 'admin']),
});
type FormValues = z.infer<typeof schema>;


export function TeamPage() {
  const { user: me, company } = useAuth();
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ['users'], queryFn: () => api<{ items: User[] }>('/users').then((r) => r.items) });
  const invites = useQuery({
    queryKey: ['invites'],
    queryFn: () => api<{ items: Invitation[] }>('/users/invites').then((r) => r.items),
  });

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { role: 'user' } });

  const create = useMutation({
    // The link goes only to the invitee's e-mail; the admin never sees it.
    mutationFn: (data: FormValues) => api<InviteResult>('/users/invites', { method: 'POST', body: data }),
    onSuccess: ({ invite }) => {
      toast.success(`Convite enviado para ${invite.email}`);
      reset({ name: '', email: '', role: 'user' });
      void qc.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) setError('email', { message: err.message });
      else toast.error(err instanceof ApiError ? err.message : 'Não foi possível gerar o convite');
    },
  });

  const renew = useMutation({
    mutationFn: (i: Invitation) => api<InviteResult>(`/users/invites/${i.id}/renew`, { method: 'POST' }),
    onSuccess: ({ invite }) => {
      toast.success(`Novo convite enviado para ${invite.email}. O link anterior deixou de valer.`);
      void qc.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível reenviar o convite'),
  });

  const cancelInvite = useMutation({
    mutationFn: (i: Invitation) => api<void>(`/users/invites/${i.id}`, { method: 'DELETE' }),
    onSuccess: (_d, i) => {
      toast.success(`Convite de ${i.name} cancelado`);
      void qc.invalidateQueries({ queryKey: ['invites'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível cancelar'),
  });


  const [toRemove, setToRemove] = useState<User | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  // Role and removal take effect on the member's next request (the API reloads them on every call).
  const updateRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: Role }) => api<User>(`/users/${id}`, { method: 'PATCH', body: { role } }),
    onSuccess: (u) => {
      toast.success(`${u.name} agora é ${u.role === 'admin' ? 'administrador' : 'cliente'}`);
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => {
      toast.error(err instanceof ApiError ? err.message : 'Não foi possível alterar o papel');
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const remove = useMutation({
    mutationFn: (u: User) => api<void>(`/users/${u.id}`, { method: 'DELETE' }),
    onSuccess: (_data, u) => {
      toast.success(`${u.name} foi removido da equipe`);
      setToRemove(null);
      void qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (err) => toast.error(err instanceof ApiError ? err.message : 'Não foi possível remover'),
  });

  const list = users.data ?? [];
  const admins = list.filter((u) => u.role === 'admin').length;
  const stats = [
    { icon: Users, label: 'Pessoas', value: list.length },
    { icon: ShieldCheck, label: 'Administradores', value: admins },
    { icon: UserIcon, label: 'Clientes', value: list.length - admins },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        title="Equipe"
        eyebrow={company?.name}
        description={`Pessoas com acesso ao catálogo e ao assistente da ${company?.name}.`}
        actions={
          <Button variant="secondary" icon={<KeyRound className="h-4 w-4" />} onClick={() => setPasswordOpen(true)}>
            Alterar minha senha
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        {stats.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-center gap-3.5 rounded-2xl border border-stone-200/80 bg-white p-4 shadow-card dark:border-stone-800 dark:bg-stone-900">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-medium text-stone-500 dark:text-stone-400">{label}</p>
              <p className="font-display text-2xl font-bold tabular-nums">{users.isLoading ? '—' : value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <div className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-card dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
              <h2 className="font-display font-bold">Membros</h2>
              <Badge>{list.length}</Badge>
            </div>
            <ul className="divide-y divide-stone-100 dark:divide-stone-800">
              {users.isLoading &&
                Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="flex items-center gap-3 px-5 py-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 flex-1" />
                  </li>
                ))}
              {list.map((u) => (
                <li key={u.id} className="flex items-center gap-3.5 px-5 py-3.5 transition hover:bg-stone-50 dark:hover:bg-stone-800/40">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {u.name}{' '}
                      {u.id === me?.id && (
                        <span className="ml-1 rounded-md bg-stone-100 px-1.5 py-0.5 text-[10px] font-semibold text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                          você
                        </span>
                      )}
                    </p>
                    <p className="truncate text-xs text-stone-500 dark:text-stone-400">{u.email}</p>
                  </div>
                  {u.id === me?.id ? (
                    <div className="flex flex-col items-end gap-1">
                      <Badge tone={u.role === 'admin' ? 'brand' : 'neutral'}>
                        {u.role === 'admin' ? <ShieldCheck className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                        {u.role === 'admin' ? 'Administrador' : 'Cliente'}
                      </Badge>
                      {u.createdAt && <span className="hidden text-[11px] text-stone-400 sm:block">desde {formatDate(u.createdAt)}</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Select
                        aria-label={`Papel de ${u.name}`}
                        className="h-9! w-auto py-0 text-xs"
                        value={u.role}
                        disabled={updateRole.isPending || (u.role === 'admin' && admins <= 1)}
                        onChange={(e) => updateRole.mutate({ id: u.id, role: e.target.value as Role })}
                      >
                        <option value="user">Cliente</option>
                        <option value="admin">Administrador</option>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Remover ${u.name}`}
                        title="Remover da equipe"
                        disabled={u.role === 'admin' && admins <= 1}
                        onClick={() => setToRemove(u)}
                        icon={<Trash2 className="h-4 w-4" />}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {(invites.data?.length ?? 0) > 0 && (
            <div className="overflow-hidden rounded-3xl border border-stone-200/80 bg-white shadow-card dark:border-stone-800 dark:bg-stone-900">
              <div className="flex items-center justify-between border-b border-stone-100 px-5 py-4 dark:border-stone-800">
                <h2 className="font-display font-bold">Convites pendentes</h2>
                <Badge>{invites.data!.length}</Badge>
              </div>
              <ul className="divide-y divide-stone-100 dark:divide-stone-800">
                {invites.data!.map((i) => (
                  <li key={i.id} className="flex items-center gap-3.5 px-5 py-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-500 dark:bg-stone-800 dark:text-stone-400">
                      <Mail className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {i.name}{' '}
                        <span className="ml-1 text-xs font-normal text-stone-500 dark:text-stone-400">
                          {i.role === 'admin' ? 'Administrador' : 'Cliente'}
                        </span>
                      </p>
                      <p className="truncate text-xs text-stone-500 dark:text-stone-400">{i.email}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                        <Clock className="h-3 w-3" /> expira em {formatDate(i.expiresAt)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Reenviar convite para ${i.name}`}
                      title="Reenviar convite"
                      disabled={renew.isPending}
                      onClick={() => renew.mutate(i)}
                      icon={<RefreshCw className="h-4 w-4" />}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Cancelar convite de ${i.name}`}
                      title="Cancelar convite"
                      disabled={cancelInvite.isPending}
                      onClick={() => cancelInvite.mutate(i)}
                      icon={<X className="h-4 w-4" />}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit((d) => create.mutate(d))}
          noValidate
          className="h-fit space-y-4 rounded-3xl border border-stone-200/80 bg-white p-6 shadow-card lg:sticky lg:top-8 dark:border-stone-800 dark:bg-stone-900"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow">
              <UserPlus className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold">Convidar pessoa</h2>
              <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
                A pessoa recebe um e-mail com um link para criar a própria senha. O link vale 7 dias.
              </p>
            </div>
          </div>
          <Field label="Nome" htmlFor="t-name" error={errors.name?.message}>
            <Input id="t-name" icon={<UserIcon />} placeholder="Maria Silva" invalid={!!errors.name} {...register('name')} />
          </Field>
          <Field label="E-mail" htmlFor="t-email" error={errors.email?.message}>
            <Input id="t-email" type="email" icon={<Mail />} placeholder="maria@empresa.com" invalid={!!errors.email} {...register('email')} />
          </Field>
          <Field label="Papel" htmlFor="t-role" hint="Clientes só visualizam produtos e usam o chat.">
            <Select id="t-role" {...register('role')}>
              <option value="user">Cliente</option>
              <option value="admin">Administrador</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" loading={create.isPending} icon={<Send className="h-4 w-4" />}>
            Enviar convite
          </Button>
        </form>
      </div>

      <Modal
        open={!!toRemove}
        onClose={() => setToRemove(null)}
        size="sm"
        title="Remover da equipe?"
        icon={<Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />}
        footer={
          <>
            <Button variant="secondary" onClick={() => setToRemove(null)}>Cancelar</Button>
            <Button variant="danger" loading={remove.isPending} onClick={() => toRemove && remove.mutate(toRemove)}>Remover</Button>
          </>
        }
      >
        <p className="text-sm text-stone-600 dark:text-stone-400">
          <strong className="text-stone-900 dark:text-stone-100">{toRemove?.name}</strong> perde o acesso na hora, e as conversas dessa pessoa
          com o assistente são apagadas. Essa ação não pode ser desfeita.
        </p>
      </Modal>
      <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
    </div>
  );
}
