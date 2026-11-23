import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
if (!process.env.BASE_URL) throw new Error('Historical reference specs require an authorized BASE_URL and updated UI/account fixtures.');
export default defineConfig({
  testDir: './tests',
  testMatch: ['**/auth/**/*.spec.ts', '**/search/**/*.spec.ts', '**/searchFilters/**/*.spec.ts',
    '**/browseListings/**/*.spec.ts', '**/hub/**/*.spec.ts', '**/mls-listing-page/**/*.spec.ts',
    '**/mortgage/**/*.spec.ts', '**/buyerAgreement/**/*.spec.ts', '**/tour/**/*.spec.ts'], forbidOnly: !!process.env.CI, workers: 1, retries: 0,
  timeout: 60_000, expect: { timeout: 30_000 }, reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: process.env.BASE_URL,
    trace: 'off', screenshot: 'off', video: 'off' },
});
