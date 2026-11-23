import { test } from '../../fixtures/auth.fixture';
import RebatePage from '../../pages/hub/RebatePage';
// Illustrative valid budgets; align product rules with your authorized target.
for (const price of [500_000, 750_000, 1_200_000]) {
  test(`valid budget ${price} updates the interactive estimate and persists @reference`, async ({ page }) => {
    const rebate = new RebatePage(page);
    await test.step('Open the home budget editor', () => rebate.openEditPriceModal());
    await test.step('Enter a valid budget', () => rebate.editHomePrice(price));
    const savings = await test.step('Verify the interactive breakdown', () => rebate.verifyRebateBreakdownInteractive(price));
    await rebate.saveHomePrice({ expectSuccess: true });
    await test.step('Verify saved estimate', () => rebate.verifySavingsAmount(savings));
  });
}
