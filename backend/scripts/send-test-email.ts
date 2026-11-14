/**
 * Sends one e-mail with the current SMTP settings, to check them before relying on
 * invites and sign-up confirmation. Usage: npm run mail:test -w backend -- you@example.com
 */
import { env } from '../src/config/env';
import { createMailer } from '../src/modules/mail/mailer';

async function main() {
  const to = process.argv[2];
  if (!to || !to.includes('@')) {
    console.error('Informe o destinatário: npm run mail:test -w backend -- voce@exemplo.com');
    process.exit(1);
  }
  if (!env.SMTP_URL) {
    console.error('SMTP_URL não está definida no .env: o e-mail iria só para o log. Veja a seção de e-mail no README.');
    process.exit(1);
  }

  // Never print SMTP_URL itself: it carries the password.
  const server = new URL(env.SMTP_URL);
  console.log(`Enviando para ${to} via ${server.hostname}:${server.port || '(porta padrão)'} como ${env.MAIL_FROM}…`);

  await createMailer().send({
    to,
    subject: 'Teste de envio da Vitrine IA',
    text: `Se você recebeu este e-mail, o envio está configurado.\n\nOs links dos e-mails vão apontar para ${env.APP_URL}.`,
    html: `<p>Se você recebeu este e-mail, o envio está configurado.</p><p>Os links dos e-mails vão apontar para <strong>${env.APP_URL}</strong>.</p>`,
  });
  console.log('Enviado. Confira a caixa de entrada (e o spam).');
}

main().catch((err: Error) => {
  console.error(`Falhou: ${err.message}`);
  if (/535|Username and Password not accepted|Invalid login/i.test(err.message)) {
    console.error('Dica (Gmail): use uma senha de app, sem espaços, e troque o "@" do usuário por %40 na SMTP_URL.');
  }
  process.exit(1);
});
