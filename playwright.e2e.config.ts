import 'dotenv/config';
import { defineConfig, devices } from '@playwright/test';
const baseURL = process.env.BASE_URL;
if (!baseURL) throw new Error('Set BASE_URL in your private .env before running browser specs.');
if (!['http:', 'https:'].includes(new URL(baseURL).protocol)) throw new Error('BASE_URL must use HTTP(S).');
export default defineConfig({
  testDir: './tests/assistant', forbidOnly: !!process.env.CI,
  workers: 1, retries: 0, timeout: 60_000, expect: { timeout: 30_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL, trace: 'off', video: 'off', screenshot: 'off' },
  projects: [ { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] } ],
});
