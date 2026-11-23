import { test } from '../../fixtures/auth.fixture';
import BreadcrumbPage from '../../pages/search/BreadcrumbPage';

test.describe('Search @P2', () => {
  test.use({ role: 'BUYER' });
  test('buyer can validate random Florida county urls @fl-only', async ({ page }, testInfo) => {
    const breadcrumbPage = new BreadcrumbPage(page);

    await test.step('Validate random Florida county URL sample', async () => {
      await breadcrumbPage.validateRandomCountySample(testInfo, 'homes/fl', 1);
    });
  });
});
