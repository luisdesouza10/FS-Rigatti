import { zodResolver } from '@hookform/resolvers/zod';
import { KeyRound, Lock } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import { Button } from '../ui/Button';
import { Field, PasswordInput } from '../ui/Field';
import { Modal } from '../ui/Modal';

const schema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual'),
    newPassword: z
      .string()
      .min(8, 'Mínimo de 8 caracteres')
      .refine((v) => v.trim().length >= 8, 'Mínimo de 8 caracteres visíveis')
      // bcrypt ignores everything past 72 bytes; the API rejects longer passwords.
      .refine((v) => new TextEncoder().encode(v).length <= 72, 'Máximo de 72 bytes (cerca de 72 letras sem acento)'),
    confirm: z.string(),
  })
  .refine((v) => v.newPassword === v.confirm, { path: ['confirm'], message: 'As senhas não conferem' });
type FormValues = z.infer<typeof schema>;

const EMPTY: FormValues = { currentPassword: '', newPassword: '', confirm: '' };

export function ChangePasswordModal({ open, onClose }: Readonly<{ open: boolean; onClose: () => void }>) {
  const { changePassword } = useAuth();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) reset(EMPTY);
  }, [open, reset]);

  const submit = handleSubmit(async (d) => {
    try {
      await changePassword(d.currentPassword, d.newPassword);
      toast.success('Senha alterada. As outras sessões foram encerradas.');
      onClose();
    } catch (err) {
      const field = err instanceof ApiError ? err.details?.[0]?.field : undefined;
      if (field === 'currentPassword' || field === 'newPassword') setError(field, { message: err instanceof ApiError ? err.message : '' });
      else toast.error(err instanceof ApiError ? err.message : 'Não foi possível alterar a senha');
    }
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="sm"
      title="Alterar senha"
      description="Você continua conectado aqui; as outras sessões são encerradas."
      icon={<KeyRound className="h-5 w-5" />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="change-password" loading={isSubmitting}>Salvar</Button>
        </>
      }
    >
      <form id="change-password" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Senha atual" htmlFor="cp-current" error={errors.currentPassword?.message}>
          <PasswordInput id="cp-current" autoComplete="current-password" icon={<Lock />} invalid={!!errors.currentPassword} {...register('currentPassword')} />
        </Field>
        <Field label="Nova senha" htmlFor="cp-new" error={errors.newPassword?.message}>
          <PasswordInput id="cp-new" autoComplete="new-password" icon={<Lock />} placeholder="Mínimo de 8 caracteres" invalid={!!errors.newPassword} {...register('newPassword')} />
        </Field>
        <Field label="Confirme a nova senha" htmlFor="cp-confirm" error={errors.confirm?.message}>
          <PasswordInput id="cp-confirm" autoComplete="new-password" icon={<Lock />} invalid={!!errors.confirm} {...register('confirm')} />
        </Field>
      </form>
    </Modal>
  );
}
