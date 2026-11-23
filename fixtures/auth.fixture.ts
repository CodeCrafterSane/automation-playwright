import { test as base, expect } from './base.fixture';
import LoginPage from '../pages/auth/LoginPage';
import type { Role } from '../config/roles';

type Options = { role: Role; credentialKey: string; reuseSession: boolean };
/** A fresh Playwright context per test; no original session files or mailbox access. */
export const test = base.extend<Options & { authenticated: void }>({
  role: ['BUYER', { option: true }],
  credentialKey: ['', { option: true }],
  reuseSession: [false, { option: true }],
  authenticated: [async ({ page, role, credentialKey, reuseSession }, use) => {
    if (reuseSession) throw new Error('Public reference fixtures intentionally use fresh sessions.');
    const key = credentialKey || role;
    const email = process.env[`TEST_${key}_EMAIL`];
    const password = process.env[`TEST_${key}_PASSWORD`];
    if (!email || !password) throw new Error(`Configure TEST_${key}_EMAIL and TEST_${key}_PASSWORD with a dedicated account.`);
    await new LoginPage(page).fullLogin(email, password);
    await use();
  }, { auto: true }],
});
export { expect };
