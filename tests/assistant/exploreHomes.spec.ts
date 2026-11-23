import { test, expect } from '../../fixtures/assistant.fixture';
import { searchScenarios, searchPrompt } from '../../common/testData/assistant/validScenarios';

test.describe('Assistant Explore homes @P1 @assistant @assistantExplore @valid', () => {
  test.setTimeout(240_000);
  for (const scenario of searchScenarios) {
    test(`${scenario.id}: validates matching homes and opens the selected listing`, async ({ page, assistant }, testInfo) => {
      await testInfo.attach('valid-scenario', { body: JSON.stringify(scenario, null, 2), contentType: 'application/json' });
      await test.step('Open Assistant', () => assistant.open());
      await test.step('Start Explore homes', () => assistant.chooseStarter('explore'));
      if (scenario.staged) {
        await test.step('Provide the location before refining the search', () => assistant.ask(`${scenario.city}, ${scenario.state}.`));
      }
      const response = await test.step('Provide the valid search requirements', () => assistant.ask(searchPrompt(scenario)));
      await testInfo.attach('explore-results', { body: response, contentType: 'text/plain' });
      await testInfo.attach('explore-results-screenshot', { body: await page.screenshot(), contentType: 'image/png' });
      const results = await test.step('Verify every returned listing against the requested filters', async () => {
        const listings = assistant.listings(scenario.city, scenario.stateCode);
        expect(listings.length, `Expected selectable listings for ${scenario.city}: ${response}`).toBeGreaterThan(0);
        const typePattern = /condo/i.test(scenario.propertyType) ? /condo/i : /town/i.test(scenario.propertyType) ? /town(?:house|home)/i : /single[ -]family/i;
        for (const listing of listings) {
          expect.soft(listing.price, `${listing.address}: budget`).toBeLessThanOrEqual(scenario.maxPrice);
          expect.soft(listing.beds ?? 0, `${listing.address}: minimum bedrooms`).toBeGreaterThanOrEqual(scenario.beds);
          expect.soft(listing.baths ?? 0, `${listing.address}: minimum bathrooms`).toBeGreaterThanOrEqual(scenario.baths);
          expect.soft(listing.text, `${listing.address}: property type`).toMatch(typePattern);
        }
        return listings;
      });
      const selected = results[0]!;
      await testInfo.attach('selected-listing', { body: JSON.stringify(selected), contentType: 'application/json' });
      const listing = await test.step('Confirm the external link and verify the selected property loads', () => assistant.openListing(selected.address, selected.url, selected.linkText));
      await testInfo.attach('explore-listing-handoff', { body: JSON.stringify({ address: selected.address, expectedUrl: selected.url, url: listing.url() }), contentType: 'application/json' });
      await expect(listing).toHaveURL(selected.url);
      await listing.close();
    });
  }
});
