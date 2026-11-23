import { random } from '../../utils/random';
import { test } from '../../fixtures/auth.fixture';
import { expect } from '@playwright/test';
import SavedListingsPage from '../../pages/collection/SavedListingsPage';
import SearchPage, {
  type PropertyTypeFilter,
  type SearchLocation,
} from '../../pages/search/SearchPage';

const SEARCH_STATE_CODES = ['FL', 'GA', 'CA'] as const;
const PRICE_MIN_VALUES = [25000, 50000, 100000, 200000, 300000, 500000] as const;
const HIGHER_BIASED_PRICE_MAX_VALUES = [
  750000,
  1000000,
  1500000,
  2000000,
  3000000,
  3000000,
  5000000,
  5000000,
  10000000,
  20000000,
] as const;
const LOWER_BIASED_BED_BATH_VALUES = [1, 1, 1, 2, 2, 2, 3, 3, 4, 5] as const;
const PROPERTY_TYPE_FILTERS: PropertyTypeFilter[] = [
  { label: 'Single Family', value: 'Single Family Residence' },
  { label: 'Condominium', value: 'Condominium' },
  { label: 'Townhouse', value: 'Townhouse' },
];
const PROPERTY_TYPE_COUNT_OPTIONS = [1, 2, 2, 3] as const;

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}

function shuffled<T>(items: readonly T[]): T[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex]!,
      shuffledItems[index]!,
    ];
  }

  return shuffledItems;
}

function randomPropertyTypes() {
  return shuffled(PROPERTY_TYPE_FILTERS).slice(0, randomItem(PROPERTY_TYPE_COUNT_OPTIONS));
}

function randomUiThresholdFilters(location: SearchLocation) {
  const priceMin = randomItem(PRICE_MIN_VALUES);
  const validMaxValues = HIGHER_BIASED_PRICE_MAX_VALUES.filter((value) => value > priceMin);

  return {
    baths: randomItem(LOWER_BIASED_BED_BATH_VALUES),
    beds: randomItem(LOWER_BIASED_BED_BATH_VALUES),
    location,
    priceMax: randomItem(validMaxValues),
    priceMin,
    propertyTypes: randomPropertyTypes(),
  };
}

test.describe('@P1 Search', () => {
  test.use({ role: 'BUYER' });

  test('user can apply search filters from the UI and see matching property results', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180000);

    const searchPage = new SearchPage(page);
    const savedListingsPage = new SavedListingsPage(page);
    let totalValidatedPropertyCards = 0;

    await test.step('Open search from dashboard nav', async () => {
      console.info('[Search UI Spec] Next: open Search from dashboard nav');
      await searchPage.clickSearch();
      console.info(`[Search UI Spec] Landed on Search\n\n${page.url()}\n`);
    });

    const randomizedStateCodes = shuffled(SEARCH_STATE_CODES);

    console.info(`[Search UI Spec] State run order: ${randomizedStateCodes.join(' -> ')}`);

    for (const [stateIndex, stateCode] of randomizedStateCodes.entries()) {
      const isLastState = stateIndex === randomizedStateCodes.length - 1;
      const location = searchPage.getRandomUiFilterValidationLocationForState(stateCode);
      const appliedFilters = randomUiThresholdFilters(location);

      await test.step(`Apply random filters for ${stateCode}`, async () => {
        console.info('[Search UI Spec] Applying filters');
        console.info(`  state: ${stateCode}`);
        console.info(`  location: ${appliedFilters.location.label}`);
        console.info(`  price: ${appliedFilters.priceMin}-${appliedFilters.priceMax}`);
        console.info(`  beds: exact ${appliedFilters.beds}`);
        console.info(`  baths: exact ${appliedFilters.baths}`);
        console.info(
          `  property types: ${appliedFilters.propertyTypes.map(({ label }) => label).join(', ')}`,
        );

        console.info('[Search UI Spec] Next: clear current search criteria through UI only');
        await searchPage.clearSearchCriteriaThroughUi();
        console.info(`[Search UI Spec] Cleared search criteria\n\n${page.url()}\n`);

        const validatedPropertyCardCount =
          await searchPage.applyUiThresholdFiltersAndValidatePropertyCards({
            baths: appliedFilters.baths,
            beds: appliedFilters.beds,
            location: appliedFilters.location,
            priceMax: appliedFilters.priceMax,
            priceMin: appliedFilters.priceMin,
            propertyTypes: appliedFilters.propertyTypes,
          });

        totalValidatedPropertyCards += validatedPropertyCardCount;
        console.info(
          `[Search UI Spec] Completed ${stateCode} filter validation with ${validatedPropertyCardCount} validated visible card(s)\n\n${page.url()}\n`,
        );
      });

      if (isLastState) {
        await test.step(`Save final randomized search for ${stateCode}`, async () => {
          const savedSearchName = `Automated Search Filters ${stateCode} ${Date.now()}`;
          const editedSavedSearchName = `${savedSearchName} Edited`;

          await searchPage.saveCurrentSearchThroughUi(savedSearchName);
          console.info(`[Search UI Spec] Saved final search for ${stateCode}\n\n${page.url()}\n`);

          await savedListingsPage.goToSavedPageFromSideNav();
          await savedListingsPage.openSavedSearchesSection();
          await savedListingsPage.editTopSavedSearchNameAndMaxPrice(editedSavedSearchName, '$1.2M');
          console.info(
            `[Search UI Spec] Edited final saved search from "${savedSearchName}" to "${editedSavedSearchName}"\n\n${page.url()}\n`,
          );
        });
      }
    }

    expect(
      totalValidatedPropertyCards,
      'Expected at least one visible property card across FL, GA, and CA random filter validations.',
    ).toBeGreaterThan(0);
  });
});
