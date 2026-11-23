import { test as base, expect } from '@playwright/test';
import AssistantPage from '../pages/assistant/AssistantPage';
export const test = base.extend<{ assistant: AssistantPage; discoveryAssistant: AssistantPage }>({
  assistant: async ({ page }, use) => { await use(new AssistantPage(page)); },
  discoveryAssistant: async ({ browser, baseURL }, use) => {
    const context = await browser.newContext({ baseURL });
    try { await use(new AssistantPage(await context.newPage())); }
    finally { await context.close(); }
  },
});
export { expect };
