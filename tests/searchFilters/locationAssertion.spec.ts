import { random } from '../../utils/random';
import { expect } from '@playwright/test';
import { test } from '../../fixtures/auth.fixture';
import SearchPage, { type SearchLocation } from '../../pages/search/SearchPage';

const SEARCH_STATE_CODES = ['FL', 'GA', 'CA'] as const;
const LOCATION_SAMPLE_SIZE_PER_STATE = 10;

function sampleLocations(locations: SearchLocation[], sampleSize: number) {
  const shuffledLocations = [...locations];

  for (let index = shuffledLocations.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffledLocations[index], shuffledLocations[randomIndex]] = [
      shuffledLocations[randomIndex]!,
      shuffledLocations[index]!,
    ];
  }

  return shuffledLocations.slice(0, sampleSize);
}

test.describe('@P2 Search', () => {
  test.use({ role: 'BUYER' });

  test('random active search locations appear in autosuggest', async ({ page }) => {
    test.setTimeout(240000);

    const searchPage = new SearchPage(page);
    const locations = searchPage.getUiFilterValidationLocations();
    const sampledLocations = SEARCH_STATE_CODES.flatMap((stateCode) => {
      const stateLocations = locations.filter(
        (location) => location.params.state_abbr === stateCode,
      );

      return sampleLocations(stateLocations, LOCATION_SAMPLE_SIZE_PER_STATE);
    });
    const missingLocations: string[] = [];
    const locationInput = page.getByPlaceholder('Enter zip code, county or city');

    console.info(
      `[Search Location Validation] Checking ${LOCATION_SAMPLE_SIZE_PER_STATE} random location(s) per state (${sampledLocations.length} total) out of ${locations.length}.`,
    );

    await test.step('Open search and clear existing criteria', async () => {
      await searchPage.clickSearch();
      await searchPage.clearSearchCriteriaThroughUi();
    });

    await test.step(`Validate ${sampledLocations.length} sampled location suggestions`, async () => {
      for (const location of sampledLocations) {
        await locationInput.click();
        await locationInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await locationInput.press('Backspace');
        await locationInput.pressSequentially(location.label, { delay: 10 });

        const option = page
          .getByRole('option')
          .filter({ hasText: location.inputValue ?? new RegExp(location.label, 'i') })
          .or(page.getByText(location.inputValue ?? new RegExp(location.label, 'i')))
          .filter({ visible: true })
          .first();

        if (!(await option.isVisible({ timeout: 5000 }).catch(() => false))) {
          missingLocations.push(location.label);
        }

        await locationInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
        await locationInput.press('Backspace');
      }
    });

    await test.step('Assert sampled locations appeared in autosuggest', async () => {
      console.info(`[Search Location Validation] Missing ${missingLocations.length} location(s).`);
      console.info(missingLocations.join('\n'));

      expect(
        missingLocations,
        'Expected sampled active locations to appear in search autosuggest.',
      ).toEqual([]);
    });
  });
});
