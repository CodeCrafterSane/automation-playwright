import { randomUUID } from 'node:crypto';
/** Supply an inbox you own; no external counters or database credentials. */
export async function uniqueTestEmail(base: string): Promise<string> {
  const match = /^([^@]+)@([^@]+)$/.exec(base);
  if (!match) throw new Error('TEST_CONTACT_EMAIL must be an email address');
  return `${match[1]}+demo-${randomUUID()}@${match[2]}`;
}
