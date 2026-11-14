import { createHash, randomBytes } from 'node:crypto';

/** Only this hash is stored, so a database leak doesn't hand out working links. */
export const hashLinkToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** Random token for a single-use link sent by e-mail (invite, sign-up confirmation). */
export function createLinkToken(ttlMs: number) {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashLinkToken(token), expiresAt: new Date(Date.now() + ttlMs) };
}
