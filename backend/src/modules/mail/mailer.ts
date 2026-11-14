import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class SmtpMailer implements Mailer {
  private readonly transport;

  constructor(url: string) {
    // eslint-disable-next-line sonarjs/no-clear-text-protocols -- TLS comes from SMTP_URL itself (smtps:// or STARTTLS); smtp:// is only for local Mailpit.
    this.transport = nodemailer.createTransport(url);
  }

  async send(message: MailMessage) {
    await this.transport.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

/** Development without SMTP_URL: the e-mail (and its link) goes to the API log. */
class LogMailer implements Mailer {
  async send(message: MailMessage) {
    logger.info({ to: message.to, subject: message.subject }, `E-mail (não enviado; configure SMTP_URL):\n${message.text}`);
  }
}

class NullMailer implements Mailer {
  async send() {}
}

export function createMailer(): Mailer {
  if (env.SMTP_URL) return new SmtpMailer(env.SMTP_URL);
  return env.NODE_ENV === 'test' ? new NullMailer() : new LogMailer();
}

/** Sends or fails with a clear 503; callers undo what they saved for this e-mail. */
export async function sendOrFail(mailer: Mailer, message: MailMessage, undo: () => Promise<unknown>) {
  try {
    await mailer.send(message);
  } catch (err) {
    logger.error({ err, to: message.to }, 'E-mail delivery failed');
    await undo().catch(() => undefined);
    throw new AppError(503, 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.', 'MAIL_UNAVAILABLE');
  }
}
