import { env } from '../../config/env';
import type { MailMessage } from './mailer';

/** Names come from users (company, person): never trust them inside HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function layout(paragraphs: string[], action?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 16px;line-height:1.5">${p}</p>`).join('');
  const button = action
    ? `<p style="margin:24px 0"><a href="${escapeHtml(action.url)}" style="background:#0f5e6b;color:#fff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(action.label)}</a></p>` +
      `<p style="margin:0 0 16px;font-size:13px;color:#666">Se o botão não funcionar, copie este endereço no navegador:<br>${escapeHtml(action.url)}</p>`
    : '';
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:520px;color:#1c1917">${body}${button}<p style="margin:24px 0 0;font-size:12px;color:#888">Vitrine IA</p></div>`;
}

export const mailTemplates = {
  invite(input: { to: string; name: string; companyName: string; inviterName: string; token: string }): MailMessage {
    const url = `${env.APP_URL}/convite/${input.token}`;
    const subject = `Convite para a equipe da ${input.companyName} na Vitrine IA`;
    return {
      to: input.to,
      subject,
      text:
        `Olá, ${input.name}!\n\n${input.inviterName} convidou você para a equipe da ${input.companyName} na Vitrine IA.\n\n` +
        `Para aceitar e criar sua senha, abra o link abaixo (vale 7 dias e só pode ser usado uma vez):\n${url}\n\n` +
        'Se você não esperava este convite, ignore este e-mail.',
      html: layout(
        [
          `Olá, ${escapeHtml(input.name)}!`,
          `${escapeHtml(input.inviterName)} convidou você para a equipe da <strong>${escapeHtml(input.companyName)}</strong> na Vitrine IA.`,
          'O link vale 7 dias e só pode ser usado uma vez. Se você não esperava este convite, ignore este e-mail.',
        ],
        { label: 'Aceitar convite', url },
      ),
    };
  },

  confirmSignup(input: { to: string; name: string; companyName: string; token: string }): MailMessage {
    const url = `${env.APP_URL}/confirmar-email/${input.token}`;
    return {
      to: input.to,
      subject: 'Confirme seu e-mail para criar sua conta na Vitrine IA',
      text:
        `Olá, ${input.name}!\n\nPara terminar o cadastro da ${input.companyName}, confirme seu e-mail abrindo o link abaixo ` +
        `(vale 24 horas):\n${url}\n\nSe não foi você, ignore este e-mail: nenhuma conta será criada.`,
      html: layout(
        [
          `Olá, ${escapeHtml(input.name)}!`,
          `Para terminar o cadastro da <strong>${escapeHtml(input.companyName)}</strong>, confirme seu e-mail. O link vale 24 horas.`,
          'Se não foi você, ignore este e-mail: nenhuma conta será criada.',
        ],
        { label: 'Confirmar e-mail', url },
      ),
    };
  },

  /** Sent instead of a confirmation when the e-mail already has an account (the API answers the same). */
  signupAttemptOnExistingAccount(input: { to: string }): MailMessage {
    const url = `${env.APP_URL}/login`;
    return {
      to: input.to,
      subject: 'Tentativa de cadastro com o seu e-mail na Vitrine IA',
      text:
        'Alguém tentou criar uma conta na Vitrine IA com este e-mail, mas você já tem uma conta.\n\n' +
        `Se foi você, entre com sua senha:\n${url}\n\nSe não foi você, ignore este e-mail: nada mudou na sua conta.`,
      html: layout(
        [
          'Alguém tentou criar uma conta na Vitrine IA com este e-mail, mas você já tem uma conta.',
          'Se não foi você, ignore este e-mail: nada mudou na sua conta.',
        ],
        { label: 'Entrar', url },
      ),
    };
  },
};
