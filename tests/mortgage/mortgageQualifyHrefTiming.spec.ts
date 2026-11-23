import { test, expect } from '../../fixtures/base.fixture';
import MortgagePage from '../../pages/mortgage/MortgagePage';

const MAX_HREF_CHANGE_MS = 1500;

test.describe('Mortgage Qualify Href Timing @P2', () => {
  test('measures when qualify href changes to the mortgage form path', async ({
    page,
    browserName,
  }, testInfo) => {
    const browserLabel = testInfo.project.name || browserName;
    const mortgagePage = new MortgagePage(page);

    await test.step('Open mortgage page from base header', async () => {
      await mortgagePage.openFromBaseHeader();
    });

    const { hrefChangeMs, mortgageFormSeenAt } =
      await test.step('Measure qualify href timing', () => mortgagePage.measureQualifyHrefTiming());

    await test.step('Assert qualify href timing threshold', async () => {
      console.log(
        `[Mortgage href timing][${browserLabel}] change needed: ${
          hrefChangeMs === undefined ? 'unavailable' : `${hrefChangeMs}ms`
        }`,
      );

      expect(
        mortgageFormSeenAt,
        'Expected /mortgage/form/va-loan-1 to appear within the timing window.',
      ).toBeDefined();
      expect(
        hrefChangeMs,
        `Expected mortgage href change to complete within ${MAX_HREF_CHANGE_MS}ms.`,
      ).toBeLessThanOrEqual(MAX_HREF_CHANGE_MS);
    });
  });
});
