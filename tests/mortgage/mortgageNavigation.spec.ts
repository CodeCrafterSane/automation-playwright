import { test } from '../../fixtures/base.fixture';
import MortgagePage from '../../pages/mortgage/MortgagePage';

test.describe('Mortgage Navigation @P2', () => {
  test('opens mortgage page from the base header mortgage control', async ({ page }) => {
    const mortgagePage = new MortgagePage(page);

    await test.step('Open mortgage page from base header', async () => {
      await mortgagePage.openFromBaseHeader();
    });

    const { attempts, controls } = await test.step('Collect mortgage navigation controls', () =>
      mortgagePage.collectControlsFor());

    await test.step('Validate mortgage navigation controls', async () => {
      console.log(`[Mortgage] fetch attempts completed: ${attempts}`);
      console.log(`[Mortgage] final link/button count: ${controls.length}`);
      mortgagePage.expectMortgageNavigationHrefs(controls);
      mortgagePage.printMortgageControls(controls);
    });
  });
});
