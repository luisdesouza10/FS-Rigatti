import { z } from 'zod';

const email = z.email('E-mail inválido').trim().toLowerCase().max(160);

/** bcrypt only uses the first 72 bytes; anything past that would be silently ignored. */
export const PASSWORD_MAX_BYTES = 72;

/** Rules for a new password (register, invite, change). Login stays lenient for existing accounts. */
export const passwordSchema = z
  .string()
  .min(8, 'A senha precisa ter pelo menos 8 caracteres')
  // Checked on a trimmed copy only; the password itself is stored as typed.
  .refine((v) => v.trim().length >= 8, { message: 'A senha precisa ter pelo menos 8 caracteres visíveis' })
  .refine((v) => Buffer.byteLength(v, 'utf8') <= PASSWORD_MAX_BYTES, {
    message: `A senha pode ter no máximo ${PASSWORD_MAX_BYTES} bytes (cerca de 72 letras sem acento)`,
  });

/** Registering creates a new company (tenant) and its first admin. */
export const registerSchema = z.object({
  companyName: z.string().trim().min(2, 'Nome da empresa muito curto').max(120),
  name: z.string().trim().min(2, 'Nome muito curto').max(120),
  email,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Informe a senha').max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Informe a senha atual').max(128),
  newPassword: passwordSchema,
});

export const inviteTokenSchema = z.string().trim().min(20).max(200);

export const confirmEmailSchema = z.object({ token: inviteTokenSchema });

export const acceptInviteSchema = z.object({
  token: inviteTokenSchema,
  password: passwordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;
