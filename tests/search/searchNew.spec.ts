import { test, expect } from '../../fixtures/auth.fixture';
import SearchPage from '../../pages/search/SearchPage';

test.describe('Search @P3', () => {
  test.use({ role: 'BUYER' });

  test('admin can navigate to search', async ({ page }) => {
    const searchPage = new SearchPage(page);

    await test.step('Open search from navigation', async () => {
      await searchPage.clickSearch();
    });

    await test.step('Verify search URL', async () => {
      await expect(page).toHaveURL(/search/);
    });
  });
});
