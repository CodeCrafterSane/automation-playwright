import { test } from '../../fixtures/auth.fixture';
import BreadcrumbPage from '../../pages/search/BreadcrumbPage';

test.describe('Search @P2', () => {
  test.use({ role: 'BUYER' });
  test('buyer can validate random Georgia county urls @ga-only', async ({ page }, testInfo) => {
    const breadcrumbPage = new BreadcrumbPage(page);

    await test.step('Validate random Georgia county URL sample', async () => {
      await breadcrumbPage.validateRandomCountySample(testInfo, 'homes/ga', 1);
    });
  });
});
