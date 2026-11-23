import { Page } from '@playwright/test';
import env from './env';

export async function clearAuthStorage(page: Page) {
  await page.context().clearCookies();
  await page.goto(env.baseURL);
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}
