import { random } from '../../utils/random';
import { contracts } from '../../config/contracts';
import { errors, expect, Locator, Page } from '@playwright/test';
import {
  clearRecordedToasts,
  expectToastVisibleOrRecorded,
  installToastRecorder,
} from '../../utils/toastRecorder';
import env from '../../utils/env';

export type SearchFilter = {
  label: string;
  params: Record<string, string>;
};

export type SearchLocation = {
  label: string;
  inputValue?: RegExp;
  params: Record<string, string>;
};

export type TourSearchStateCode = 'FL' | 'GA' | 'TX' | 'CA';

export type SearchWithUnsavedResults = {
  appliedFilter: SearchFilter;
  unsavedPropertyCards: Locator[];
};

export type SearchWithPropertyResults = {
  appliedFilter: SearchFilter;
  location: SearchLocation;
  propertyCards: Locator[];
};

export type PropertyIdentifier = {
  propertyId?: string;
  titleOrAddress: string;
};

export type UiSearchThresholdFilter = {
  baths?: number;
  beds?: number;
  location: SearchLocation;
  priceMax?: number;
  priceMin?: number;
  propertyTypes?: PropertyTypeFilter[];
};

type StateCode = 'FL' | 'GA' | 'CA';

export type PropertyTypeFilter = {
  label: string;
  value: string;
};

type CityZipLocationSeed = {
  city: string;
  zip: string;
};

type CountyLocationSeed = {
  county: string;
};

type NeighborhoodLocationSeed = {
  city: string;
  neighborhood: string;
};

type StateLocationGroup = {
  state: string;
  stateAbbr: StateCode;
  cities: CityZipLocationSeed[];
  counties: CountyLocationSeed[];
  neighborhoods: NeighborhoodLocationSeed[];
};

function escapeRegExpForPattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createCityAndZipLocations(group: StateLocationGroup): SearchLocation[] {
  return group.cities.flatMap(({ city, zip }): SearchLocation[] => [
    {
      label: `${city}, ${group.stateAbbr}`,
      inputValue: new RegExp(escapeRegExpForPattern(city), 'i'),
      params: { city, state: group.state, state_abbr: group.stateAbbr },
    },
    {
      label: `${zip}, ${group.stateAbbr}`,
      inputValue: new RegExp(zip, 'i'),
      params: { zip_code: zip, state_abbr: group.stateAbbr },
    },
  ]);
}

function createCountyLocations(group: StateLocationGroup): SearchLocation[] {
  return group.counties.map(({ county }) => ({
    label: `${county} County, ${group.stateAbbr}`,
    inputValue: new RegExp(escapeRegExpForPattern(county), 'i'),
    params: { county, state: group.state, state_abbr: group.stateAbbr },
  }));
}

function createNeighborhoodLocations(group: StateLocationGroup): SearchLocation[] {
  return group.neighborhoods.map(({ city, neighborhood }) => ({
    label: `${neighborhood}, ${city}, ${group.stateAbbr}`,
    inputValue: new RegExp(escapeRegExpForPattern(neighborhood), 'i'),
    params: { city, neighborhood, state: group.state, state_abbr: group.stateAbbr },
  }));
}

function createStateSearchLocations(group: StateLocationGroup): SearchLocation[] {
  return [
    ...createCityAndZipLocations(group),
    ...createCountyLocations(group),
    ...createNeighborhoodLocations(group),
  ];
}

const SEARCH_LOCATION_GROUPS: StateLocationGroup[] = [
  {
    state: 'Florida',
    stateAbbr: 'FL',
    cities: [
      { city: 'Miami', zip: '33101' },
      { city: 'Miami Beach', zip: '33139' },
      { city: 'Fort Lauderdale', zip: '33301' },
      { city: 'Boca Raton', zip: '33432' },
      { city: 'West Palm Beach', zip: '33401' },
      { city: 'Orlando', zip: '32801' },
      { city: 'Tampa', zip: '33602' },
      { city: 'St. Petersburg', zip: '33701' },
      { city: 'Clearwater', zip: '33755' },
      { city: 'Sarasota', zip: '34236' },
      { city: 'Naples', zip: '34102' },
      { city: 'Fort Myers', zip: '33901' },
      { city: 'Cape Coral', zip: '33904' },
      { city: 'Jacksonville', zip: '32202' },
      { city: 'Tallahassee', zip: '32301' },
      { city: 'Gainesville', zip: '32601' },
      { city: 'Ocala', zip: '34471' },
      { city: 'Pensacola', zip: '32502' },
      { city: 'Destin', zip: '32541' },
      { city: 'Daytona Beach', zip: '32114' },
      { city: 'Delray Beach', zip: '33444' },
      { city: 'Coral Springs', zip: '33065' },
      { city: 'Hollywood', zip: '33020' },
      { city: 'Hialeah', zip: '33010' },
      { city: 'Doral', zip: '33122' },
      { city: 'Aventura', zip: '33180' },
      { city: 'Key West', zip: '33040' },
      { city: 'Kissimmee', zip: '34741' },
      { city: 'Lakeland', zip: '33801' },
      { city: 'Melbourne', zip: '32901' },
      { city: 'Port St. Lucie', zip: '34952' },
      { city: 'Palm Coast', zip: '32137' },
      { city: 'Bonita Springs', zip: '34134' },
    ],
    counties: [
      { county: 'Miami-Dade' },
      { county: 'Broward' },
      { county: 'Palm Beach' },
      { county: 'Orange' },
      { county: 'Hillsborough' },
      { county: 'Duval' },
      { county: 'Leon' },
      { county: 'Collier' },
      { county: 'Lee' },
      { county: 'Sarasota' },
      { county: 'Alachua' },
    ],
    neighborhoods: [
      { neighborhood: 'Brickell', city: 'Miami' },
      { neighborhood: 'Wynwood', city: 'Miami' },
      { neighborhood: 'South Beach', city: 'Miami Beach' },
      { neighborhood: 'Downtown Orlando', city: 'Orlando' },
      { neighborhood: 'Ybor City', city: 'Tampa' },
      { neighborhood: 'Riverside', city: 'Jacksonville' },
      { neighborhood: 'Midtown Miami', city: 'Miami' },
    ],
  },
  {
    state: 'Georgia',
    stateAbbr: 'GA',
    cities: [
      { city: 'Atlanta', zip: '30303' },
      { city: 'Athens', zip: '30601' },
      { city: 'Augusta', zip: '30901' },
      { city: 'Columbus', zip: '31901' },
      { city: 'Savannah', zip: '31401' },
      { city: 'Macon', zip: '31201' },
      { city: 'Alpharetta', zip: '30009' },
      { city: 'Marietta', zip: '30060' },
      { city: 'Roswell', zip: '30075' },
      { city: 'Sandy Springs', zip: '30328' },
      { city: 'Johns Creek', zip: '30022' },
      { city: 'Dunwoody', zip: '30338' },
      { city: 'Smyrna', zip: '30080' },
      { city: 'Decatur', zip: '30030' },
      { city: 'Brookhaven', zip: '30319' },
      { city: 'Peachtree City', zip: '30269' },
      { city: 'Newnan', zip: '30263' },
      { city: 'Carrollton', zip: '30117' },
      { city: 'Rome', zip: '30161' },
      { city: 'Dalton', zip: '30720' },
      { city: 'Gainesville', zip: '30501' },
      { city: 'Lawrenceville', zip: '30046' },
      { city: 'Duluth', zip: '30096' },
      { city: 'Norcross', zip: '30071' },
      { city: 'Suwanee', zip: '30024' },
      { city: 'Stone Mountain', zip: '30083' },
      { city: 'Conyers', zip: '30012' },
      { city: 'Stockbridge', zip: '30281' },
      { city: 'McDonough', zip: '30253' },
      { city: 'Warner Robins', zip: '31088' },
      { city: 'Valdosta', zip: '31601' },
      { city: 'Statesboro', zip: '30458' },
      { city: 'Brunswick', zip: '31520' },
    ],
    counties: [
      { county: 'Fulton' },
      { county: 'DeKalb' },
      { county: 'Cobb' },
      { county: 'Gwinnett' },
      { county: 'Chatham' },
      { county: 'Muscogee' },
      { county: 'Clarke' },
      { county: 'Richmond' },
      { county: 'Bibb' },
      { county: 'Henry' },
    ],
    neighborhoods: [
      { neighborhood: 'Buckhead', city: 'Atlanta' },
      { neighborhood: 'Midtown', city: 'Atlanta' },
      { neighborhood: 'Virginia-Highland', city: 'Atlanta' },
      { neighborhood: 'Downtown Decatur', city: 'Decatur' },
      { neighborhood: 'Historic Roswell', city: 'Roswell' },
      { neighborhood: 'Downtown Savannah', city: 'Savannah' },
    ],
  },
  {
    state: 'California',
    stateAbbr: 'CA',
    cities: [
      { city: 'Los Angeles', zip: '90012' },
      { city: 'San Diego', zip: '92101' },
      { city: 'San Jose', zip: '95112' },
      { city: 'San Francisco', zip: '94102' },
      { city: 'Sacramento', zip: '95814' },
      { city: 'Fresno', zip: '93721' },
      { city: 'Oakland', zip: '94607' },
      { city: 'Long Beach', zip: '90802' },
      { city: 'Anaheim', zip: '92805' },
      { city: 'Santa Ana', zip: '92701' },
      { city: 'Irvine', zip: '92612' },
      { city: 'Riverside', zip: '92501' },
      { city: 'Bakersfield', zip: '93301' },
      { city: 'Stockton', zip: '95202' },
      { city: 'Modesto', zip: '95354' },
      { city: 'Fremont', zip: '94538' },
      { city: 'Glendale', zip: '91203' },
      { city: 'Huntington Beach', zip: '92648' },
      { city: 'Santa Clarita', zip: '91355' },
      { city: 'Garden Grove', zip: '92840' },
      { city: 'Oceanside', zip: '92054' },
      { city: 'Rancho Cucamonga', zip: '91730' },
      { city: 'Santa Rosa', zip: '95401' },
      { city: 'Ontario', zip: '91764' },
      { city: 'Elk Grove', zip: '95758' },
      { city: 'Corona', zip: '92879' },
      { city: 'Lancaster', zip: '93534' },
      { city: 'Palmdale', zip: '93550' },
      { city: 'Salinas', zip: '93901' },
      { city: 'Hayward', zip: '94541' },
      { city: 'Pomona', zip: '91766' },
      { city: 'Sunnyvale', zip: '94086' },
      { city: 'Santa Barbara', zip: '93101' },
      { city: 'Carlsbad', zip: '92008' },
    ],
    counties: [
      { county: 'Los Angeles' },
      { county: 'Orange' },
      { county: 'San Diego' },
      { county: 'Santa Clara' },
      { county: 'San Francisco' },
      { county: 'Sacramento' },
      { county: 'Alameda' },
      { county: 'Riverside' },
      { county: 'Fresno' },
      { county: 'San Bernardino' },
    ],
    neighborhoods: [
      { neighborhood: 'Hollywood', city: 'Los Angeles' },
      { neighborhood: 'Venice', city: 'Los Angeles' },
      { neighborhood: 'Mission District', city: 'San Francisco' },
      { neighborhood: 'Gaslamp Quarter', city: 'San Diego' },
      { neighborhood: 'La Jolla', city: 'San Diego' },
      { neighborhood: 'Koreatown', city: 'Los Angeles' },
      { neighborhood: 'Downtown Sacramento', city: 'Sacramento' },
      { neighborhood: 'Downtown San Jose', city: 'San Jose' },
      { neighborhood: 'Pacific Beach', city: 'San Diego' },
    ],
  },
];

const SEARCH_LOCATIONS: SearchLocation[] = SEARCH_LOCATION_GROUPS.flatMap(
  createStateSearchLocations,
);

const TOUR_LOCATIONS_BY_STATE: Record<TourSearchStateCode, SearchLocation[]> = {
  FL: [
    {
      label: 'Florida',
      params: { state: 'Florida', state_abbr: 'FL' },
    },
    {
      label: 'Fort Lauderdale, FL',
      inputValue: /Fort Lauderdale/i,
      params: { city: 'Fort Lauderdale', state: 'Florida', state_abbr: 'FL' },
    },
    {
      label: 'Coral Springs, FL',
      inputValue: /Coral Springs/i,
      params: { city: 'Coral Springs', state: 'Florida', state_abbr: 'FL' },
    },
    {
      label: '33606, FL',
      inputValue: /33606/i,
      params: { zip_code: '33606', state_abbr: 'FL' },
    },
  ],
  GA: [
    {
      label: 'Georgia',
      params: { state: 'Georgia', state_abbr: 'GA' },
    },
    {
      label: 'Atlanta, GA',
      inputValue: /Atlanta/i,
      params: { city: 'Atlanta', state: 'Georgia', state_abbr: 'GA' },
    },
    {
      label: 'Columbus, GA',
      inputValue: /Columbus/i,
      params: { city: 'Columbus', state: 'Georgia', state_abbr: 'GA' },
    },
    {
      label: 'Athens, GA',
      inputValue: /Athens/i,
      params: { city: 'Athens', state: 'Georgia', state_abbr: 'GA' },
    },
  ],
  TX: [
    {
      label: 'Texas',
      params: { state: 'Texas', state_abbr: 'TX' },
    },
    {
      label: 'Austin, TX',
      inputValue: /Austin/i,
      params: { city: 'Austin', state: 'Texas', state_abbr: 'TX' },
    },
    {
      label: 'Dallas, TX',
      inputValue: /Dallas/i,
      params: { city: 'Dallas', state: 'Texas', state_abbr: 'TX' },
    },
  ],
  CA: [
    {
      label: 'California',
      params: { state: 'California', state_abbr: 'CA' },
    },
    {
      label: 'Los Angeles, CA',
      inputValue: /Los Angeles/i,
      params: { city: 'Los Angeles', state: 'California', state_abbr: 'CA' },
    },
    {
      label: 'San Diego, CA',
      inputValue: /San Diego/i,
      params: { city: 'San Diego', state: 'California', state_abbr: 'CA' },
    },
  ],
};

const PROPERTY_TYPE_FILTERS: PropertyTypeFilter[] = [
  { label: 'Single Family', value: 'Single Family Residence' },
  { label: 'Condominium', value: 'Condominium' },
  { label: 'Townhouse', value: 'Townhouse' },
];

const PRICE_MIN_VALUES = [25000, 50000, 100000, 200000, 300000, 500000];
const PRICE_MAX_VALUES = [750000, 1000000, 1500000, 2000000, 3000000, 5000000, 10000000, 20000000];
const BED_BATH_VALUES = [1, 2, 3, 4, 5];
const FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS = 20000;

/** Default homelist folder title used in save toasts (the example UI: "Saved listings"). */
export const DEFAULT_SAVED_LISTING_FOLDER_NAME = 'Saved listings';

export default class SearchPage {
  constructor(private page: Page) {}

  async clickSearch() {
    const searchLink = this.page.getByRole('link', { name: 'Search', exact: true });

    await expect(
      searchLink,
      'Expected the dashboard Search link to be visible before navigating to search.',
    ).toBeVisible();

    await searchLink.scrollIntoViewIfNeeded();
    await expect(searchLink).toBeEnabled();
    await searchLink.click();
    await this.waitForSearchPageReady();
  }

  async clearSearchCriteria() {
    await this.page.goto('/dashboard/search');
    await this.waitForSearchPageReady();

    const clearFiltersButton = this.page
      .getByRole('button', { name: 'Clear', exact: true })
      .first();

    if (await clearFiltersButton.isVisible()) {
      await clearFiltersButton.click();
      await expect(clearFiltersButton).toBeHidden();
    }

    const locationInput = this.page.getByPlaceholder('Enter zip code, county or city');

    await expect(locationInput).toBeVisible();
    await locationInput.fill('');
    await expect(locationInput).toHaveValue('');
    await this.page.goto('/dashboard/search');
    await this.waitForSearchPageReady();
  }

  async clearSearchCriteriaThroughUi() {
    await this.waitForSearchPageReady();
    this.logUiStep('Clear search criteria from UI');

    const clearFiltersButton = this.page
      .getByRole('button', { name: 'Clear', exact: true })
      .first();

    if (await clearFiltersButton.isVisible().catch(() => false)) {
      await clearFiltersButton.click();
      await expect(clearFiltersButton).toBeHidden();
      this.logUiStep('Clicked Clear on search filters');
    } else {
      this.logUiStep('Clear button not visible; continuing with current default UI state');
    }

    const locationInput = this.page.getByPlaceholder('Enter zip code, county or city');

    await expect(locationInput).toBeVisible();
    await locationInput.fill('');
    await expect(locationInput).toHaveValue('');
    await this.waitForSearchPageReady();
    this.logUiStep('Location input cleared through UI');
  }

  getRandomSearchLocation() {
    return this.randomItem(SEARCH_LOCATIONS);
  }

  getRandomUiFilterValidationLocationForState(stateCode: StateCode) {
    const group = SEARCH_LOCATION_GROUPS.find(({ stateAbbr }) => stateAbbr === stateCode);

    expect(
      group,
      `Expected search locations to be configured for state "${stateCode}".`,
    ).toBeTruthy();

    return this.randomItem(createCityAndZipLocations(group!));
  }

  getRandomUiPropertyTypeFilter() {
    return this.randomItem(PROPERTY_TYPE_FILTERS);
  }

  getUiFilterValidationLocations() {
    return SEARCH_LOCATION_GROUPS.flatMap(createCityAndZipLocations);
  }

  getUiFilterValidationLocation() {
    return this.prioritizeSpecificLocations([...SEARCH_LOCATIONS])[0]!;
  }

  getTourLocationForState(stateCode: TourSearchStateCode) {
    return this.randomItem(TOUR_LOCATIONS_BY_STATE[stateCode]);
  }

  getTourLocationsForState(stateCode: TourSearchStateCode) {
    return this.prioritizeSpecificLocations(this.shuffle(TOUR_LOCATIONS_BY_STATE[stateCode]));
  }

  getUnsupportedTourLocation() {
    return this.randomItem([...TOUR_LOCATIONS_BY_STATE.TX, ...TOUR_LOCATIONS_BY_STATE.CA]);
  }

  getUnsupportedTourLocations() {
    return this.shuffle([...TOUR_LOCATIONS_BY_STATE.TX, ...TOUR_LOCATIONS_BY_STATE.CA]);
  }

  getInactiveTourLocation(activeStateCode: Extract<TourSearchStateCode, 'FL' | 'GA'>) {
    return this.getTourLocationForState(activeStateCode === 'FL' ? 'GA' : 'FL');
  }

  getInactiveTourLocations(activeStateCode: Extract<TourSearchStateCode, 'FL' | 'GA'>) {
    return this.getTourLocationsForState(activeStateCode === 'FL' ? 'GA' : 'FL');
  }

  async searchLocation(location: SearchLocation) {
    await this.applySearchParams(location.params);

    if (location.inputValue) {
      await expect(this.page.getByPlaceholder('Enter zip code, county or city')).toHaveValue(
        location.inputValue,
      );
    }
  }

  async searchLocationThroughUi(location: SearchLocation) {
    const locationInput = this.page.getByPlaceholder('Enter zip code, county or city');

    this.logUiStep(`Apply location through UI: ${location.label}`);
    await expect(locationInput).toBeVisible();
    await locationInput.click();
    await locationInput.fill(location.label);
    await this.page
      .getByRole('option')
      .filter({
        hasText: location.inputValue ?? new RegExp(this.escapeRegExp(location.label), 'i'),
      })
      .first()
      .click();
    await this.waitForSearchResultsToSettle();
    this.logUiStep(`Location applied through UI: ${location.label}`);
  }

  async applyUiThresholdFiltersAndValidatePropertyCards(filters: UiSearchThresholdFilter) {
    this.logUiStep('Start applying UI threshold filters');
    await this.searchLocationThroughUi(filters.location);

    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      this.logUiStep(
        `Apply price filter through UI: min=${filters.priceMin ?? 'none'}, max=${filters.priceMax ?? 'none'}`,
      );
      await this.applyPriceFilterThroughUi(filters.priceMin, filters.priceMax);
    }

    if (filters.beds !== undefined || filters.baths !== undefined) {
      this.logUiStep(
        `Apply beds & baths filter through UI: exact beds=${filters.beds ?? 'none'}, exact baths=${filters.baths ?? 'none'}`,
      );
      await this.applyBedsAndBathsFilterThroughUi(filters.beds, filters.baths);
    }

    if (filters.propertyTypes?.length) {
      this.logUiStep(
        `Apply property type filter through UI: ${filters.propertyTypes.map(({ label }) => label).join(', ')}`,
      );
      await this.applyPropertyTypeFilterThroughUi(filters.propertyTypes);
    }

    await this.waitForSearchResultsToSettle(FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS);
    this.logUiStep('Search results settled after UI filters');
    await this.assertFiltersOverviewReflectsSelection(filters);
    this.logUiStep('Validated Filters overview reflects selected UI filters');
    await this.assertSearchUrlContainsParams({
      ...filters.location.params,
      ...(filters.priceMin !== undefined ? { list_price__gte: String(filters.priceMin) } : {}),
      ...(filters.priceMax !== undefined ? { list_price__lte: String(filters.priceMax) } : {}),
      ...(filters.beds !== undefined ? { beds: String(filters.beds) } : {}),
      ...(filters.baths !== undefined ? { baths: String(filters.baths) } : {}),
      ...(filters.propertyTypes?.length
        ? { property_sub_type: filters.propertyTypes.map(({ value }) => value) }
        : {}),
    });
    this.logUiStep('Validated search URL contains selected filter params');
    await this.waitForVisibleCardsOrNoResults(FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS);
    const validatedPropertyCardCount =
      await this.assertVisiblePropertyCardsMatchThresholdFilters(filters);
    this.logUiStep('Validated visible property cards match selected UI filters');

    return validatedPropertyCardCount;
  }

  async applyRandomSearchFilterWithPropertyResults(
    location: SearchLocation,
    minimumPropertyCards: number,
    maxFilterAttempts = 4,
  ): Promise<SearchWithPropertyResults> {
    const initialFilter = this.getRandomSearchFilter();
    const attemptedFilterKeys = new Set<string>();
    const candidateFilters = [
      initialFilter,
      ...this.getHighYieldSearchFilters(),
      ...this.shuffle(this.getFallbackSearchFilters()),
    ]
      .filter((filter) => {
        const filterKey = this.searchFilterKey(filter);

        if (attemptedFilterKeys.has(filterKey)) {
          return false;
        }

        attemptedFilterKeys.add(filterKey);
        return true;
      })
      .slice(0, maxFilterAttempts);
    const attempts: string[] = [];

    for (const filter of candidateFilters) {
      try {
        await this.applySearchParamsAndWaitForFreshResults(
          {
            ...location.params,
            ...filter.params,
          },
          FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS,
        );
      } catch (error) {
        attempts.push(
          `${filter.label}: search results did not settle at ${this.page.url()} (${this.errorSummary(error)})`,
        );
        continue;
      }

      const propertyCards = await this.getVisiblePropertyCards(minimumPropertyCards);
      attempts.push(`${filter.label}: ${propertyCards.length} visible property card(s)`);

      if (propertyCards.length >= minimumPropertyCards) {
        return { appliedFilter: filter, location, propertyCards };
      }
    }

    throw new Error(
      `No usable property was found after trying all fallback search filters. Location: "${location.label}". Tried ${attempts.join(
        '; ',
      )}.`,
    );
  }

  async prepareSearchWithPropertyResults(
    location: SearchLocation,
    minimumPropertyCards: number,
    maxFilterAttempts = 1,
  ): Promise<SearchWithPropertyResults> {
    await this.expectAuthenticatedDashboardShell();
    await this.clearSearchCriteria();
    await this.searchLocation(location);

    const result = await this.applyRandomSearchFilterWithPropertyResults(
      location,
      minimumPropertyCards,
      maxFilterAttempts,
    );

    expect(
      result.propertyCards.length,
      `Expected at least ${minimumPropertyCards} property card(s) for "${location.label}" after applying filter "${result.appliedFilter.label}".`,
    ).toBeGreaterThanOrEqual(minimumPropertyCards);

    return result;
  }

  async prepareSearchLocationWithOptionalPropertyResults(
    location: SearchLocation,
    minimumPropertyCards: number,
  ): Promise<SearchWithPropertyResults | undefined> {
    await this.expectAuthenticatedDashboardShell();
    await this.clearSearchCriteria();
    await this.searchLocation(location);
    await this.waitForSearchResultsToSettle(45000);

    const propertyCards = await this.getVisiblePropertyCards(minimumPropertyCards);

    if (propertyCards.length >= minimumPropertyCards) {
      return {
        appliedFilter: {
          label: 'Location only',
          params: {},
        },
        location,
        propertyCards,
      };
    }

    await this.expectNoPropertyResultsWithBookTourFallback();

    return undefined;
  }

  async prepareSearchWithPropertyResultsAcrossLocations(
    locations: SearchLocation[],
    minimumPropertyCards: number,
    maxFilterAttempts = 1,
    maxLocationAttempts = 3,
  ): Promise<SearchWithPropertyResults> {
    const attempts: string[] = [];
    const candidateLocations = locations.slice(0, maxLocationAttempts);

    for (const location of candidateLocations) {
      try {
        return await this.prepareSearchWithPropertyResults(
          location,
          minimumPropertyCards,
          maxFilterAttempts,
        );
      } catch (error) {
        attempts.push(`${location.label}: ${this.errorSummary(error)}`);
      }
    }

    throw new Error(
      `No usable property was found across ${candidateLocations.length} location(s). Tried ${attempts.join(
        '; ',
      )}.`,
    );
  }

  async prepareSearchWithTourRequestablePropertyAcrossLocations(
    locations: SearchLocation[],
    minimumPropertyCards: number,
  ): Promise<SearchWithPropertyResults & { propertyCard: Locator }> {
    const attempts: string[] = [];

    for (const location of locations) {
      try {
        const result = await this.prepareSearchWithPropertyResults(
          location,
          Math.max(minimumPropertyCards, 3),
          2,
        );
        const propertyCard = await this.findRequestTourEnabledPropertyCard(result.propertyCards);

        if (propertyCard) {
          return { ...result, propertyCard };
        }

        attempts.push(
          `${location.label}: property cards found, but none had an enabled Request a tour CTA`,
        );
      } catch (error) {
        attempts.push(`${location.label}: ${this.errorSummary(error)}`);
      }
    }

    throw new Error(
      `No property with an enabled Request a tour CTA was found across ${locations.length} location(s). Tried ${attempts.join(
        '; ',
      )}.`,
    );
  }

  getRandomPropertyTypeFilter(): SearchFilter {
    const propertyType = this.randomItem(PROPERTY_TYPE_FILTERS);

    return {
      label: `Property Type: ${propertyType.label}`,
      params: { property_sub_type: propertyType.value },
    };
  }

  getRandomPriceRange(): SearchFilter {
    const min = this.randomItem(PRICE_MIN_VALUES);
    const validMaxValues = PRICE_MAX_VALUES.filter((max) => max > min);
    const max = this.randomItem(validMaxValues);

    return {
      label: `Price: ${this.formatPrice(min)} - ${this.formatPrice(max)}`,
      params: {
        list_price__gte: String(min),
        list_price__lte: String(max),
      },
    };
  }

  getRandomBedFilter(): SearchFilter {
    const beds = this.randomItem(BED_BATH_VALUES);

    return {
      label: `Beds: ${beds}+`,
      params: { beds__gte: String(beds) },
    };
  }

  getRandomBathFilter(): SearchFilter {
    const baths = this.randomItem(BED_BATH_VALUES);

    return {
      label: `Baths: ${baths}+`,
      params: { baths__gte: String(baths) },
    };
  }

  async applyRandomSearchFilter(location: SearchLocation) {
    const filter = this.getRandomSearchFilter();

    await this.applySearchParamsAndWaitForFreshResults({
      ...location.params,
      ...filter.params,
    });

    return filter;
  }

  async applyRandomSearchFilterWithUnsavedResults(
    location: SearchLocation,
    minimumUnsavedPropertyCards: number,
  ): Promise<SearchWithUnsavedResults> {
    const initialFilter = this.getRandomSearchFilter();
    const attemptedFilterKeys = new Set<string>();
    const candidateFilters = [
      initialFilter,
      ...this.shuffle(this.getFallbackSearchFilters()),
    ].filter((filter) => {
      const filterKey = this.searchFilterKey(filter);

      if (attemptedFilterKeys.has(filterKey)) {
        return false;
      }

      attemptedFilterKeys.add(filterKey);
      return true;
    });
    const attempts: string[] = [];

    for (const filter of candidateFilters) {
      try {
        await this.applySearchParamsAndWaitForFreshResults(
          {
            ...location.params,
            ...filter.params,
          },
          FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS,
        );
      } catch (error) {
        attempts.push(
          `${filter.label}: search results did not settle at ${this.page.url()} (${this.errorSummary(error)})`,
        );
        continue;
      }

      const visiblePropertyCardCount = await this.visiblePropertyCards().count();
      const unsavedPropertyCards = await this.getUnsavedPropertyCards(minimumUnsavedPropertyCards);
      attempts.push(
        `${filter.label}: ${visiblePropertyCardCount} visible property card(s), ${unsavedPropertyCards.length} unsaved card(s)`,
      );

      if (unsavedPropertyCards.length >= minimumUnsavedPropertyCards) {
        return { appliedFilter: filter, unsavedPropertyCards };
      }
    }

    throw new Error(
      `No unsaved property was found after trying all fallback search filters. Location: "${location.label}". Tried ${attempts.join(
        '; ',
      )}.`,
    );
  }

  async prepareSearchWithUnsavedResults(
    minimumUnsavedPropertyCards: number,
  ): Promise<SearchWithUnsavedResults> {
    await this.clickSearch();
    await expect(this.page).toHaveURL(/search/);
    await this.clearSearchCriteria();

    const searchLocation = this.getRandomSearchLocation();

    await this.searchLocation(searchLocation);

    const result = await this.applyRandomSearchFilterWithUnsavedResults(
      searchLocation,
      minimumUnsavedPropertyCards,
    );

    expect(
      result.unsavedPropertyCards.length,
      `Expected at least ${minimumUnsavedPropertyCards} unsaved property card(s) for "${searchLocation.label}" after applying filter "${result.appliedFilter.label}".`,
    ).toBeGreaterThanOrEqual(minimumUnsavedPropertyCards);

    return result;
  }

  firstPropertyResult(): Locator {
    return this.page
      .getByRole('link')
      .filter({ hasText: /\$\s?\d[\d,]*/ })
      .first();
  }

  firstPropertySaveButton(): Locator {
    return this.page
      .getByRole('button', { name: /^(Add to collection|Remove from collection)$/ })
      .first();
  }

  async waitForPropertyResults() {
    await expect(this.firstPropertyResult()).toBeVisible();
    await expect(this.firstPropertySaveButton()).toBeVisible();
  }

  async waitForSearchResultsToSettle(timeout = 30000) {
    const firstVisiblePropertyCard = this.visiblePropertyCards().first();
    const noResultsHeading = this.page
      .getByRole('heading', {
        name: /didn.t find any homes matching your search|No properties found in this area/i,
      })
      .first();
    const placeholderProfile = this.placeholderProfileButton();
    const resultSignal = firstVisiblePropertyCard.or(noResultsHeading).first();

    await expect(
      resultSignal.or(placeholderProfile).first(),
      'Expected search results to finish loading with a property card or the no-results message.',
    ).toBeVisible({ timeout });

    if (await placeholderProfile.isVisible().catch(() => false)) {
      console.info('Search entered the logged-out "Your Name" placeholder before results loaded.');
      await this.page.waitForTimeout(5000);
      const resultsAppeared = await resultSignal.isVisible().catch(() => false);
      const placeholderPersists = await placeholderProfile.isVisible().catch(() => false);

      if (placeholderPersists && !resultsAppeared) {
        throw new Error(
          'Search entered the logged-out "Your Name" placeholder before results loaded.',
        );
      }
    }
  }

  async gotoSearchResults(searchResultsUrl: string) {
    await this.gotoSearchResultsAndWaitForFreshResults(searchResultsUrl);
  }

  async getUnsavedPropertyCards(maxCards = Number.POSITIVE_INFINITY) {
    const propertyCards = this.unsavedPropertyCards();
    const propertyCardCount = Math.min(await propertyCards.count(), maxCards);

    const stablePropertyCards: Locator[] = [];

    for (let index = 0; index < propertyCardCount; index += 1) {
      stablePropertyCards.push(await this.stablePropertyCard(propertyCards.nth(index)));
    }

    return stablePropertyCards;
  }

  async getVisiblePropertyCards(maxCards = Number.POSITIVE_INFINITY) {
    const propertyCards = this.visiblePropertyCards();
    const propertyCardCount = Math.min(await propertyCards.count(), maxCards);
    const stablePropertyCards: Locator[] = [];

    for (let index = 0; index < propertyCardCount; index += 1) {
      stablePropertyCards.push(await this.stablePropertyCard(propertyCards.nth(index)));
    }

    return stablePropertyCards;
  }

  selectRandomUnsavedPropertyCard(propertyCards: Locator[]) {
    return this.randomItem(propertyCards);
  }

  async findRequestTourEnabledPropertyCard(propertyCards: Locator[]) {
    const eligiblePropertyCards: Locator[] = [];

    for (const propertyCard of propertyCards) {
      const stablePropertyCard = await this.stablePropertyCard(propertyCard);
      const tourCta = this.requestTourCtaForProperty(stablePropertyCard);

      if (!(await tourCta.isVisible().catch(() => false))) {
        continue;
      }

      if (await this.isDisabledLike(tourCta)) {
        continue;
      }

      eligiblePropertyCards.push(stablePropertyCard);
    }

    return eligiblePropertyCards.length > 0 ? this.randomItem(eligiblePropertyCards) : undefined;
  }

  async getPropertyTitleOrAddress(propertyCard: Locator) {
    const propertyText = (await propertyCard.innerText()).trim();
    const propertyLine =
      propertyText
        .split('\n')
        .map((line) => line.trim())
        .find(
          (line) =>
            /,\s*[A-Z]{2}\s+\d{5}\b/.test(line) || /,\s*(GA|Georgia|FL|Florida)\b/i.test(line),
        ) || propertyText;

    expect(propertyLine.length).toBeGreaterThan(0);

    return propertyLine;
  }

  async getPropertyIdentifier(propertyCard: Locator): Promise<PropertyIdentifier> {
    return {
      propertyId: await this.getPropertyId(propertyCard),
      titleOrAddress: await this.getPropertyTitleOrAddress(propertyCard),
    };
  }

  propertyCardByIdentifier(propertyIdentifier: PropertyIdentifier): Locator {
    if (propertyIdentifier.propertyId) {
      return this.propertyCards()
        .filter({ has: this.page.locator(`a[href*="${propertyIdentifier.propertyId}"]`) })
        .first();
    }

    return this.propertyCards().filter({ hasText: propertyIdentifier.titleOrAddress }).first();
  }

  requestTourCtaForProperty(propertyCard: Locator) {
    return propertyCard
      .getByRole('button', { name: /request a tour/i })
      .or(propertyCard.getByRole('link', { name: /request a tour/i }))
      .or(propertyCard.locator('button, a, [role="button"]').filter({ hasText: /request a tour/i }))
      .first();
  }

  makeOfferCtaForProperty(propertyCard: Locator) {
    return propertyCard
      .getByRole('button', { name: /make (an )?offer/i })
      .or(propertyCard.getByRole('link', { name: /make (an )?offer/i }))
      .or(
        propertyCard.locator('button, a, [role="button"]').filter({ hasText: /make (an )?offer/i }),
      )
      .first();
  }

  listingTourCta() {
    return this.page
      .getByRole('button', { name: /book a tour|request a tour/i })
      .or(this.page.getByRole('link', { name: /book a tour|request a tour/i }))
      .or(
        this.page
          .locator('button, a, [role="button"]')
          .filter({ hasText: /book a tour|request a tour/i }),
      )
      .first();
  }

  listingMakeOfferCta() {
    return this.page
      .getByRole('button', { name: /make (an )?offer/i })
      .or(this.page.getByRole('link', { name: /make (an )?offer/i }))
      .or(this.page.locator('button, a, [role="button"]').filter({ hasText: /make (an )?offer/i }))
      .first();
  }

  listingSignBuyerAgreementCta() {
    return this.page
      .locator('button, a, [role="button"]')
      .filter({ hasText: /sign buyer agreement/i })
      .filter({ visible: true })
      .first();
  }

  async expectPropertyCardTourCtaDisabled(propertyCard: Locator) {
    const tourCta = this.requestTourCtaForProperty(propertyCard);

    await propertyCard.scrollIntoViewIfNeeded();
    await expect(
      tourCta,
      'Expected Request a tour CTA to be visible on the property card.',
    ).toBeVisible();
    await expect
      .poll(async () => await this.isDisabledLike(tourCta), {
        message: 'Expected Request a tour CTA to be disabled on the property card.',
      })
      .toBe(true);
    await this.expectUnavailableTourTooltip(tourCta);
  }

  async clickRequestTourForProperty(propertyCard: Locator) {
    const tourCta = this.requestTourCtaForProperty(propertyCard);

    await propertyCard.scrollIntoViewIfNeeded();
    await expect(
      tourCta,
      'Expected Request a tour CTA to be visible on the property card.',
    ).toBeVisible();
    await expect
      .poll(async () => !(await this.isDisabledLike(tourCta)), {
        message: 'Expected Request a tour CTA to be enabled before booking.',
      })
      .toBe(true);
    await tourCta.click();
  }

  async openListingForProperty(propertyCard: Locator, propertyIdentifier?: PropertyIdentifier) {
    const stablePropertyCard = await this.stablePropertyCard(propertyCard);
    const propertyDetailUrl = await this.getPropertyDetailUrl(stablePropertyCard);

    if (!propertyDetailUrl) {
      throw new Error('Selected property card did not include a property detail link.');
    }

    await this.openListingUrlAndWait(propertyDetailUrl, propertyIdentifier);
  }

  async expectListingTourCtaDisabled() {
    const tourCta = this.listingTourCta();

    await expect(
      tourCta,
      'Expected Book a tour CTA to be visible on the listing page.',
    ).toBeVisible();
    await expect
      .poll(async () => await this.isDisabledLike(tourCta), {
        message: 'Expected Book a tour CTA to be disabled on the listing page.',
      })
      .toBe(true);
    await this.expectUnavailableTourTooltip(tourCta);
  }

  async clickRequestTourOnListingPage() {
    const tourCta = this.listingTourCta();

    await expect(tourCta, 'Expected listing page Request a tour CTA to be visible.').toBeVisible({
      timeout: 30000,
    });
    await expect
      .poll(async () => !(await this.isDisabledLike(tourCta)), {
        message: 'Expected listing page Request a tour CTA to be enabled before booking.',
      })
      .toBe(true);
    await tourCta.click();
  }

  async canRequestTourOnListingPage() {
    const tourCta = this.listingTourCta();

    if (!(await tourCta.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    return !(await this.isDisabledLike(tourCta));
  }

  async expectListingTourRequestStarted() {
    await expect(
      this.listingMakeOfferCta().or(this.listingSignBuyerAgreementCta()).first(),
      'Expected listing page to show the next action after requesting a tour.',
    ).toBeVisible({ timeout: 30000 });
  }

  async expectPropertyCardCannotRequestAnotherTour(propertyIdentifier: PropertyIdentifier) {
    const propertyCard = this.propertyCardByIdentifier(propertyIdentifier);
    const makeOfferCta = this.makeOfferCtaForProperty(propertyCard);

    if (!(await propertyCard.isVisible({ timeout: 30000 }).catch(() => false))) {
      await expect(
        this.page
          .getByRole('heading', { name: /didn.t find any homes matching your search/i })
          .or(this.page.getByText(/didn.t find any homes matching your search/i))
          .first(),
        `Expected requested property "${propertyIdentifier.titleOrAddress}" to be hidden only when search results no longer contain matching homes.`,
      ).toBeVisible();
      return;
    }

    await expect(
      makeOfferCta,
      `Expected requested property "${propertyIdentifier.titleOrAddress}" to show Make an offer.`,
    ).toBeVisible({ timeout: 30000 });
    await expect(this.requestTourCtaForProperty(propertyCard)).toBeHidden();
  }

  async expectNoPropertyResultsWithBookTourFallback() {
    await this.expectAuthenticatedDashboardShell();
    await expect(
      this.page
        .getByRole('heading', { name: /didn.t find any homes matching your search/i })
        .or(this.page.getByText(/didn.t find any homes matching your search/i))
        .first(),
      'Expected authenticated no-results state when unavailable-state search has no property cards.',
    ).toBeVisible({ timeout: 30000 });
    await expect(
      this.page
        .getByRole('link', { name: /book a tour/i })
        .or(this.page.getByRole('button', { name: /book a tour/i }))
        .first(),
      'Expected no-results fallback to offer Book a tour.',
    ).toBeVisible();
  }

  async getFirstPropertyTitleOrAddress() {
    return this.getPropertyTitleOrAddress(this.firstPropertyResult());
  }

  saveButtonForProperty(propertyCard: Locator) {
    return propertyCard
      .getByRole('button', { name: /^(Add to collection|Remove from collection)$/ })
      .first();
  }

  unsavedSaveButtonForProperty(propertyCard: Locator) {
    return propertyCard.getByRole('button', { name: 'Add to collection', exact: true }).first();
  }

  savedSaveButtonForProperty(propertyCard: Locator) {
    return propertyCard
      .getByRole('button', { name: 'Remove from collection', exact: true })
      .first();
  }

  async expectPropertyIsUnsaved(propertyCard: Locator) {
    const saveButton = this.unsavedSaveButtonForProperty(propertyCard);

    await propertyCard.scrollIntoViewIfNeeded();
    await expect(
      propertyCard,
      'Selected property card must be visible before checking saved state.',
    ).toBeVisible();
    await saveButton.scrollIntoViewIfNeeded();
    await expect(
      saveButton,
      'Selected property must not already be saved before clicking save.',
    ).toBeVisible();
    await expect(saveButton).toHaveAccessibleName('Add to collection');
  }

  async saveProperty(propertyCard: Locator) {
    const stablePropertyCard = await this.stablePropertyCard(propertyCard);
    const saveButton = this.unsavedSaveButtonForProperty(stablePropertyCard);

    await stablePropertyCard.scrollIntoViewIfNeeded();
    await expect(
      stablePropertyCard,
      'Selected property card must be visible before saving.',
    ).toBeVisible();
    await saveButton.scrollIntoViewIfNeeded();
    await this.expectPropertyIsUnsaved(stablePropertyCard);
    await expect(saveButton).toBeEnabled();
    await clearRecordedToasts(this.page);

    const saveResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes(contracts.savedProperty) &&
        response.request().method().toUpperCase() === 'POST',
      { timeout: 30000 },
    );

    await saveButton.click();

    const saveResponse = await saveResponsePromise.catch((err) => {
      if (err instanceof errors.TimeoutError) {
        return null;
      }
      throw err;
    });
    if (!saveResponse) {
      throw new Error(
        'Expected POST the configured saved-property route after clicking Add to collection, but no request completed.',
      );
    }
    if (!saveResponse.ok()) {
      throw new Error(
        `Save listing API failed with status ${saveResponse.status()} for ${saveResponse.url()}.`,
      );
    }

    const updatedStablePropertyCard = await this.stablePropertyCard(propertyCard);
    const updatedSaveButton = this.saveButtonForProperty(updatedStablePropertyCard);

    await expect(
      updatedSaveButton,
      'Expected selected property save button to switch to "Remove from collection" after saving.',
    ).toHaveAccessibleName('Remove from collection', { timeout: 30000 });
    await expect(this.unsavedSaveButtonForProperty(updatedStablePropertyCard)).toBeHidden();
    await expect(this.savedSaveButtonForProperty(updatedStablePropertyCard)).toBeVisible();
  }

  async saveRandomPropertyFromResults({
    unsavedPropertyCards,
  }: SearchWithUnsavedResults): Promise<PropertyIdentifier> {
    const propertyCard = this.selectRandomUnsavedPropertyCard(unsavedPropertyCards);
    const propertyIdentifier = await this.getPropertyIdentifier(propertyCard);

    await this.expectPropertyIsUnsaved(propertyCard);
    await this.saveProperty(propertyCard);
    await expect(this.saveButtonForProperty(propertyCard)).toHaveAccessibleName(
      'Remove from collection',
    );
    expect(propertyIdentifier.titleOrAddress).toBeTruthy();
    await this.assertSavedToastVisible(propertyIdentifier);

    return propertyIdentifier;
  }

  async savePropertyAndOpenSavedListingCollectionModal(
    propertyCard: Locator,
    propertyIdentifier: PropertyIdentifier,
    folderName = DEFAULT_SAVED_LISTING_FOLDER_NAME,
  ) {
    const stablePropertyCard = await this.stablePropertyCard(propertyCard);
    const saveButton = this.unsavedSaveButtonForProperty(stablePropertyCard);

    await stablePropertyCard.scrollIntoViewIfNeeded();
    await expect(
      stablePropertyCard,
      'Selected property card must be visible before saving.',
    ).toBeVisible();
    await saveButton.scrollIntoViewIfNeeded();
    await this.expectPropertyIsUnsaved(stablePropertyCard);
    await expect(saveButton).toBeEnabled();
    await clearRecordedToasts(this.page);
    await this.installSavedToastChangeAutoClick(propertyIdentifier, folderName);

    const saveResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes(contracts.savedProperty) &&
        response.request().method().toUpperCase() === 'POST',
      { timeout: 30000 },
    );

    await saveButton.click();

    const saveResponse = await saveResponsePromise.catch((err) => {
      if (err instanceof errors.TimeoutError) {
        return null;
      }
      throw err;
    });
    if (!saveResponse) {
      throw new Error(
        'Expected POST the configured saved-property route after clicking Add to collection, but no request completed.',
      );
    }
    if (!saveResponse.ok()) {
      throw new Error(
        `Save listing API failed with status ${saveResponse.status()} for ${saveResponse.url()}.`,
      );
    }

    await this.expectSavedListingCollectionModalVisible();
  }

  async assertSavedToastVisible(
    propertyIdentifier: PropertyIdentifier,
    folderName = DEFAULT_SAVED_LISTING_FOLDER_NAME,
  ) {
    const toastText = this.savedToastText(propertyIdentifier, folderName);

    await expectToastVisibleOrRecorded(
      this.page,
      this.toast(toastText),
      toastText,
      `Expected save toast for "${propertyIdentifier.titleOrAddress}" in "${folderName}".`,
    );
  }

  async assertUnsavedToastVisible(
    propertyIdentifier: PropertyIdentifier,
    folderName = DEFAULT_SAVED_LISTING_FOLDER_NAME,
  ) {
    const toastText = this.unsavedToastText(propertyIdentifier, folderName);

    await expectToastVisibleOrRecorded(
      this.page,
      this.toast(toastText),
      toastText,
      `Expected unsave toast for "${propertyIdentifier.titleOrAddress}" in "${folderName}".`,
    );
  }

  async assertVisiblePropertyCardsMatchThresholdFilters(filters: UiSearchThresholdFilter) {
    await this.waitForVisibleCardsOrNoResults(FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS);
    const propertyCards = await this.getVisiblePropertyCards(12);

    if (propertyCards.length === 0) {
      this.logUiStep(
        'No property cards returned for selected UI filters; skipping card threshold validation',
      );
      return 0;
    }

    for (const propertyCard of propertyCards) {
      const summary = await this.getPropertyCardSummary(propertyCard);

      if (filters.priceMin !== undefined) {
        expect(
          summary.price,
          `Expected property card "${summary.text}" to expose a price for minimum-price validation.`,
        ).not.toBeNull();
        expect(
          summary.price!,
          `Expected property card to meet minimum price ${filters.priceMin}.`,
        ).toBeGreaterThanOrEqual(filters.priceMin);
      }

      if (filters.priceMax !== undefined) {
        expect(
          summary.price,
          `Expected property card "${summary.text}" to expose a price for maximum-price validation.`,
        ).not.toBeNull();
        expect(
          summary.price!,
          `Expected property card to stay at or below maximum price ${filters.priceMax}.`,
        ).toBeLessThanOrEqual(filters.priceMax);
      }

      if (filters.beds !== undefined) {
        expect(
          summary.beds,
          `Expected property card "${summary.text}" to expose beds for filter validation.`,
        ).not.toBeNull();
        expect(summary.beds!, `Expected property card to match exact beds ${filters.beds}.`).toBe(
          filters.beds,
        );
      }

      if (filters.baths !== undefined) {
        expect(
          summary.baths,
          `Expected property card "${summary.text}" to expose baths for filter validation.`,
        ).not.toBeNull();
        expect(
          summary.baths!,
          `Expected property card to match exact baths ${filters.baths}.`,
        ).toBe(filters.baths);
      }
    }

    if (filters.propertyTypes?.length) {
      await this.assertPropertyDetailPagesMatchPropertyType(propertyCards, filters.propertyTypes);
    }

    return propertyCards.length;
  }

  async clickChangeFromSavedToast(
    propertyIdentifier: PropertyIdentifier,
    folderName = DEFAULT_SAVED_LISTING_FOLDER_NAME,
  ) {
    const toastText = this.savedToastText(propertyIdentifier, folderName);
    const toast = this.toast(toastText);

    await expect(
      toast,
      `Expected save toast for "${propertyIdentifier.titleOrAddress}" before clicking Change.`,
    ).toBeVisible();
    await toast.getByRole('button', { name: 'Change', exact: true }).click();
  }

  async expectSavedListingCollectionModalVisible() {
    await expect(
      this.page
        .getByRole('dialog')
        .filter({ hasText: /saved listings/i })
        .first(),
    ).toBeVisible();
  }

  async saveCurrentSearchThroughUi(searchName: string) {
    const saveSearchButton = this.page
      .getByRole('button', { name: /save (?:this )?search/i })
      .or(this.page.getByRole('link', { name: /save (?:this )?search/i }))
      .filter({ visible: true })
      .first();

    await expect(saveSearchButton, 'Expected Save search control to be visible.').toBeVisible({
      timeout: 20000,
    });
    await saveSearchButton.click();

    const saveSearchDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /save (?:this )?search|saved search|search name/i })
      .first();

    if (await saveSearchDialog.isVisible({ timeout: 5000 }).catch(() => false)) {
      const nameInput = saveSearchDialog
        .getByRole('textbox')
        .or(saveSearchDialog.locator('input, textarea'))
        .filter({ visible: true })
        .first();

      if (await nameInput.isVisible().catch(() => false)) {
        await nameInput.fill(searchName);
      }

      const confirmButton = saveSearchDialog
        .getByRole('button', { name: /^(Save|Create|Done)$/i })
        .filter({ visible: true })
        .first();

      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
      }
    }

    const savedSearchSignal = this.page
      .locator('[data-sonner-toast]')
      .filter({ hasText: /saved search|search saved|saved/i })
      .or(this.page.getByRole('button', { name: /saved|remove saved search|unsave/i }))
      .or(this.page.getByRole('link', { name: /saved searches/i }))
      .filter({ visible: true })
      .first();

    await expect(
      savedSearchSignal,
      `Expected search "${searchName}" to be saved through the UI.`,
    ).toBeVisible({ timeout: 15000 });
    this.logUiStep(`Saved current search: ${searchName}`);
  }

  async findRandomUnsavedPropertyAcrossPages(excludedProperties: PropertyIdentifier[] = []) {
    const checkedPages: string[] = [];
    const fallbackSearchUrls = this.getUnsavedPropertyFallbackSearchUrls();
    const checkedPageKeys = new Set<string>();
    let fallbackSearchIndex = 0;

    while (true) {
      await this.waitForSearchResultsToSettle();
      await this.scrollToFirstPropertyResult();

      const currentUrl = this.page.url();
      checkedPages.push(currentUrl);
      checkedPageKeys.add(this.searchUrlKey(currentUrl));

      const unsavedPropertyCards = await this.getUnsavedPropertyCards(
        excludedProperties.length + 1,
      );

      if (unsavedPropertyCards.length > 0 && excludedProperties.length === 0) {
        return this.selectRandomUnsavedPropertyCard(unsavedPropertyCards);
      }

      for (const propertyCard of this.shuffle(unsavedPropertyCards)) {
        const propertyIdentifier = await this.getPropertyIdentifier(propertyCard);

        if (
          !excludedProperties.some((excludedProperty) =>
            this.isSameProperty(propertyIdentifier, excludedProperty),
          )
        ) {
          return propertyCard;
        }
      }

      const nextPageButton = this.nextPageButton();

      if (!(await nextPageButton.isVisible()) || !(await nextPageButton.isEnabled())) {
        const fallbackSearchUrl = this.nextUncheckedFallbackSearchUrl(
          fallbackSearchUrls,
          checkedPageKeys,
          fallbackSearchIndex,
        );

        if (fallbackSearchUrl) {
          fallbackSearchIndex = fallbackSearchUrl.nextIndex;
          try {
            await this.gotoSearchResultsAndWaitForFreshResults(
              fallbackSearchUrl.url,
              FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS,
            );
          } catch (error) {
            checkedPages.push(`${fallbackSearchUrl.url} (${this.errorSummary(error)})`);
          }
          continue;
        }

        throw new Error(
          `No eligible unsaved property card was found across ${checkedPages.length} search result page(s). Checked URLs: ${checkedPages.join(
            ', ',
          )}`,
        );
      }

      await nextPageButton.scrollIntoViewIfNeeded();
      await nextPageButton.click({ force: true });
      await expect
        .poll(() => this.page.url(), { message: 'Expected next search results page URL to load.' })
        .not.toBe(currentUrl);
    }
  }

  private getUnsavedPropertyFallbackSearchUrls() {
    const currentSearchUrl = new URL(this.page.url());
    const urls: string[] = [];
    const currentLocationParams = this.currentLocationSearchParams(currentSearchUrl);
    const currentLocationSearch = currentLocationParams.toString();

    if (currentLocationSearch) {
      urls.push(`/dashboard/search?${currentLocationSearch}`);
    }

    for (const location of SEARCH_LOCATIONS) {
      urls.push(`/dashboard/search?${new URLSearchParams(location.params).toString()}`);
    }

    return Array.from(new Set(urls));
  }

  private nextUncheckedFallbackSearchUrl(
    fallbackSearchUrls: string[],
    checkedPageKeys: Set<string>,
    startIndex: number,
  ) {
    for (let index = startIndex; index < fallbackSearchUrls.length; index += 1) {
      const fallbackSearchUrl = fallbackSearchUrls[index]!;

      if (!checkedPageKeys.has(this.searchUrlKey(fallbackSearchUrl))) {
        return { nextIndex: index + 1, url: fallbackSearchUrl };
      }
    }

    return undefined;
  }

  private currentLocationSearchParams(searchUrl: URL) {
    const locationParamKeys = ['city', 'state', 'state_abbr', 'zip_code', 'county'];
    const searchParams = new URLSearchParams();

    for (const key of locationParamKeys) {
      for (const value of searchUrl.searchParams.getAll(key)) {
        searchParams.append(key, value);
      }
    }

    return searchParams;
  }

  private searchUrlKey(searchUrl: string) {
    const url = new URL(searchUrl, this.page.url());

    return `${url.pathname}?${url.searchParams.toString()}`;
  }

  private errorSummary(error: unknown) {
    if (error instanceof Error) {
      return error.message.split('\n')[0] || error.name;
    }

    return String(error);
  }

  async expectAuthenticatedDashboardShell() {
    await expect(
      this.page,
      'Expected test to stay off logged-out auth pages before using Search.',
    ).not.toHaveURL(/\/(?:login|register)(?:\/|\?|$)/);
    const profileMenuButton = this.page.getByRole('button', { name: /profile menu/i }).first();

    await expect(
      profileMenuButton,
      'Expected logged-in dashboard shell before using Search. If this fails, the test is in a logged-out state and search results are not reliable.',
    ).toBeVisible({ timeout: 20000 });
    await expect
      .poll(
        async () => {
          const profileText = (await profileMenuButton.innerText().catch(() => ''))
            .replace(/\s+/g, ' ')
            .trim();

          return !/^(YN|Your Name)$/i.test(profileText);
        },
        {
          message:
            'Expected Search to have a real logged-in profile, not the logged-out "Your Name" placeholder.',
          timeout: 20000,
        },
      )
      .toBe(true);
  }

  private async applySearchParams(params: Record<string, string>) {
    const searchParams = new URLSearchParams(params);

    await this.page.goto(`/dashboard/search?${searchParams.toString()}`);
  }

  private async applySearchParamsAndWaitForFreshResults(
    params: Record<string, string>,
    timeout = 30000,
  ) {
    const searchParams = new URLSearchParams(params);

    await this.gotoSearchResultsAndWaitForFreshResults(
      `/dashboard/search?${searchParams.toString()}`,
      timeout,
    );
  }

  private async gotoSearchResultsAndWaitForFreshResults(searchResultsUrl: string, timeout = 30000) {
    const freshResultsResponse = this.waitForFreshPropertiesResponse(
      searchResultsUrl,
      timeout,
    ).catch(() => undefined);

    await this.page.goto(searchResultsUrl);

    const settledResults = this.waitForSearchResultsToSettle(timeout);

    await Promise.race([freshResultsResponse, settledResults]);
    await settledResults;
  }

  private async waitForSearchPageReady() {
    const locationInput = this.page.getByPlaceholder('Enter zip code, county or city');

    await expect(this.page).toHaveURL(/\/dashboard\/search(?:[/?#]|$)/);
    await expect(locationInput).toBeVisible();
    await expect(locationInput).toBeEnabled();
    this.logUiStep('Search page ready');
  }

  private waitForFreshPropertiesResponse(searchResultsUrl: string, timeout: number) {
    const expectedSearchUrl = new URL(searchResultsUrl, env.baseURL);

    return this.page.waitForResponse(
      (response) => this.isPropertiesResponseForSearchUrl(response.url(), expectedSearchUrl),
      { timeout },
    );
  }

  private isPropertiesResponseForSearchUrl(responseUrl: string, expectedSearchUrl: URL) {
    const url = new URL(responseUrl);

    if (!url.pathname.endsWith(contracts.properties)) {
      return false;
    }

    for (const [key, value] of expectedSearchUrl.searchParams) {
      if (!url.searchParams.getAll(key).includes(value)) {
        return false;
      }
    }

    return true;
  }

  private propertyCards() {
    return this.page.locator('div[class*="group/property-card"]');
  }

  private visiblePropertyCards() {
    return this.propertyCards().filter({ visible: true });
  }

  private unsavedPropertyCards() {
    return this.visiblePropertyCards()
      .filter({ has: this.page.getByRole('button', { name: 'Add to collection', exact: true }) })
      .filter({ visible: true });
  }

  private placeholderProfileButton() {
    return this.page
      .getByRole('button', { name: /profile menu/i })
      .filter({ hasText: /^\s*(YN|Your Name)\s*$/i })
      .first();
  }

  private async stablePropertyCard(propertyCard: Locator) {
    const propertyDetailUrl = await this.getPropertyDetailUrl(propertyCard);

    if (!propertyDetailUrl) {
      return propertyCard;
    }

    return this.propertyCards()
      .filter({ has: this.page.locator(`a[href="${this.escapeCssString(propertyDetailUrl)}"]`) })
      .first();
  }

  private nextPageButton() {
    return this.page.getByRole('button', { name: 'Go to next page', exact: true }).last();
  }

  private savedToastText(propertyIdentifier: PropertyIdentifier, folderName: string) {
    return new RegExp(
      `${this.escapedPropertyToastTitle(propertyIdentifier)}[\\s\\S]*Added to[\\s\\S]*${this.escapeRegExp(folderName)}`,
      'i',
    );
  }

  private unsavedToastText(propertyIdentifier: PropertyIdentifier, folderName: string) {
    return new RegExp(
      `(?:${this.escapedPropertyToastTitle(propertyIdentifier)}[\\s\\S]*)?Removed from[\\s\\S]*${this.escapeRegExp(folderName)}`,
      'i',
    );
  }

  private toast(text: RegExp) {
    return this.page.locator('[data-sonner-toast]').filter({ hasText: text }).first();
  }

  private escapedPropertyToastTitle(propertyIdentifier: PropertyIdentifier) {
    return this.escapeRegExp(propertyIdentifier.titleOrAddress.split(',')[0]!.trim());
  }

  private async installSavedToastChangeAutoClick(
    propertyIdentifier: PropertyIdentifier,
    folderName: string,
  ) {
    const propertyToastTitle = propertyIdentifier.titleOrAddress.split(',')[0]!.trim();

    await this.page.evaluate(
      ({ folderName, propertyToastTitle }) => {
        const normalize = (value: string) => value.replace(/\s+/g, ' ').trim().toLowerCase();
        const targetFolder = normalize(folderName);
        const targetTitle = normalize(propertyToastTitle);

        const clickMatchingToast = () => {
          const toasts = Array.from(document.querySelectorAll('[data-sonner-toast]'));

          for (const toast of toasts) {
            const toastText = normalize(toast.textContent || '');

            if (
              !toastText.includes(targetTitle) ||
              !toastText.includes('added to') ||
              !toastText.includes(targetFolder)
            ) {
              continue;
            }

            const changeButton = Array.from(toast.querySelectorAll('button')).find(
              (button) => normalize(button.textContent || '') === 'change',
            );

            if (changeButton instanceof HTMLElement) {
              changeButton.click();
              return true;
            }
          }

          return false;
        };

        if (clickMatchingToast()) {
          return;
        }

        const observer = new MutationObserver(() => {
          if (clickMatchingToast()) {
            observer.disconnect();
          }
        });

        observer.observe(document.body, {
          characterData: true,
          childList: true,
          subtree: true,
        });
        window.setTimeout(() => observer.disconnect(), 180000);
      },
      { folderName, propertyToastTitle },
    );
    await installToastRecorder(this.page);
  }

  private async getPropertyId(propertyCard: Locator) {
    const propertyDetailUrl = await this.getPropertyDetailUrl(propertyCard);

    return propertyDetailUrl?.split('/').filter(Boolean).pop();
  }

  private async getPropertyDetailUrl(propertyCard: Locator) {
    return propertyCard.getByRole('link').first().getAttribute('href');
  }

  private async isDisabledLike(locator: Locator) {
    const [isDisabled, ariaDisabled, disabledAttribute, dataDisabled, dataState, className] =
      await Promise.all([
        locator.isDisabled().catch(() => false),
        locator.getAttribute('aria-disabled').catch(() => null),
        locator.getAttribute('disabled').catch(() => null),
        locator.getAttribute('data-disabled').catch(() => null),
        locator.getAttribute('data-state').catch(() => null),
        locator.getAttribute('class').catch(() => null),
      ]);
    const classTokens = (className || '').split(/\s+/).filter((token) => !token.includes(':'));

    return (
      isDisabled ||
      ariaDisabled === 'true' ||
      disabledAttribute !== null ||
      dataDisabled !== null ||
      dataState === 'disabled' ||
      classTokens.some(
        (token) =>
          token === 'disabled' ||
          token.includes('cursor-not-allowed') ||
          token.includes('pointer-events-none') ||
          /^opacity-(0|25|30|40|50|60|70|75)$/.test(token),
      )
    );
  }

  private async expectUnavailableTourTooltip(locator: Locator) {
    // Disabled tour CTAs use pointer-events-none; hover the TooltipTrigger wrapper div
    // (PreventBookTourButton → data-slot="tooltip-trigger") so Radix receives pointerenter.
    const tooltipTrigger = locator.locator('xpath=ancestor::*[@data-slot="tooltip-trigger"][1]');
    await tooltipTrigger.hover({ force: true });

    // The UI can render the disabled CTA reason as either a tooltip or visible inline text,
    // depending on the page state and component version. Validate the actual help text that
    // the user sees instead of assuming a tooltip container always exists.
    const disabledTourReasonText =
      /We are not available for tours in this state|We're confirming tour availability for this property|Book a tour is only available for properties in your preferred state|Tour availability isn't available for this property|We couldn't confirm tour availability for this property|not in your preferred state|booking a tour.*preferred state|only available.*preferred state/i;

    const tooltip = this.page
      .getByRole('tooltip')
      .or(this.page.locator('[data-slot="tooltip-content"]'))
      .filter({ hasText: disabledTourReasonText })
      .filter({ visible: true })
      .first();

    const inlineReason = this.page
      .getByText(disabledTourReasonText)
      .filter({ visible: true })
      .first();

    await expect
      .poll(
        async () => {
          const tooltipVisible = await tooltip.isVisible().catch(() => false);
          const inlineVisible = await inlineReason.isVisible().catch(() => false);
          return tooltipVisible || inlineVisible;
        },
        {
          message:
            'Expected disabled tour CTA reason text to appear as either tooltip content or inline help text.',
        },
      )
      .toBe(true);
  }

  private isSameProperty(firstProperty: PropertyIdentifier, secondProperty: PropertyIdentifier) {
    if (firstProperty.propertyId && secondProperty.propertyId) {
      return firstProperty.propertyId === secondProperty.propertyId;
    }

    return firstProperty.titleOrAddress === secondProperty.titleOrAddress;
  }

  private async scrollToFirstPropertyResult() {
    if (await this.firstPropertyResult().isVisible()) {
      await this.firstPropertyResult().scrollIntoViewIfNeeded();
    }
  }

  private randomItem<T>(items: T[]) {
    expect(items.length, 'Expected at least one item to select randomly.').toBeGreaterThan(0);

    return items[Math.floor(random() * items.length)]!;
  }

  private getRandomSearchFilter() {
    return this.randomItem([
      this.getRandomPropertyTypeFilter(),
      this.getRandomPriceRange(),
      this.getRandomBedFilter(),
      this.getRandomBathFilter(),
    ]);
  }

  private getFallbackSearchFilters(): SearchFilter[] {
    return [
      ...this.getPropertyTypeFilters(),
      ...this.getPriceRangeFilters(),
      ...this.getBedFilters(),
      ...this.getBathFilters(),
    ];
  }

  private getHighYieldSearchFilters(): SearchFilter[] {
    return [
      {
        label: `Price: ${this.formatPrice(25000)} - ${this.formatPrice(20000000)}`,
        params: {
          list_price__gte: '25000',
          list_price__lte: '20000000',
        },
      },
      {
        label: 'Beds: 1+',
        params: { beds__gte: '1' },
      },
      {
        label: 'Baths: 1+',
        params: { baths__gte: '1' },
      },
      ...this.getPropertyTypeFilters(),
    ];
  }

  private getPropertyTypeFilters(): SearchFilter[] {
    return PROPERTY_TYPE_FILTERS.map((propertyType) => ({
      label: `Property Type: ${propertyType.label}`,
      params: { property_sub_type: propertyType.value },
    }));
  }

  private getPriceRangeFilters(): SearchFilter[] {
    const filters: SearchFilter[] = [];

    for (const min of PRICE_MIN_VALUES) {
      for (const max of PRICE_MAX_VALUES.filter((maxValue) => maxValue > min)) {
        filters.push({
          label: `Price: ${this.formatPrice(min)} - ${this.formatPrice(max)}`,
          params: {
            list_price__gte: String(min),
            list_price__lte: String(max),
          },
        });
      }
    }

    return filters;
  }

  private getBedFilters(): SearchFilter[] {
    return BED_BATH_VALUES.map((beds) => ({
      label: `Beds: ${beds}+`,
      params: { beds__gte: String(beds) },
    }));
  }

  private getBathFilters(): SearchFilter[] {
    return BED_BATH_VALUES.map((baths) => ({
      label: `Baths: ${baths}+`,
      params: { baths__gte: String(baths) },
    }));
  }

  private searchFilterKey(filter: SearchFilter) {
    return Object.entries(filter.params)
      .sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }

  private shuffle<T>(items: T[]) {
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

  private prioritizeSpecificLocations(locations: SearchLocation[]) {
    const specificLocations = locations.filter((location) => this.isSpecificLocation(location));
    const broadLocations = locations.filter((location) => !this.isSpecificLocation(location));

    return [...specificLocations, ...broadLocations];
  }

  private isSpecificLocation(location: SearchLocation) {
    return Boolean(location.params.city || location.params.zip_code || location.params.county);
  }

  private formatPrice(price: number) {
    return new Intl.NumberFormat('en-US', {
      currency: 'USD',
      maximumFractionDigits: 0,
      style: 'currency',
    }).format(price);
  }

  private formatPriceCompact(price: number) {
    const compact = new Intl.NumberFormat('en-US', {
      currency: 'USD',
      maximumFractionDigits: 1,
      notation: 'compact',
      style: 'currency',
    }).format(price);

    return compact.replace('.0', '');
  }

  private async applyPriceFilterThroughUi(priceMin?: number, priceMax?: number) {
    await this.openFilterMenu('Price');

    if (priceMin !== undefined) {
      await this.selectPriceBoundaryThroughUi(0, priceMin);
    }

    if (priceMax !== undefined) {
      await this.selectPriceBoundaryThroughUi(1, priceMax);
    }

    await this.commitOpenFilterMenu();
  }

  private async applyDiscreteFilterThroughUi(filterName: 'Beds' | 'Baths', minimumValue: number) {
    await this.openFilterMenu(filterName);
    await this.selectFilterOptionByText(new RegExp(`^${minimumValue}\\+?$`, 'i'));
    await this.commitOpenFilterMenu();
  }

  private async applyBedsAndBathsFilterThroughUi(beds?: number, baths?: number) {
    await this.openFilterMenu('Beds & Baths');

    if (beds !== undefined) {
      await this.selectBedsOrBathsOptionBySection('Beds', beds, {
        exactCheckboxLabel: 'Exact beds',
        optionPattern: new RegExp(`^${beds}$`, 'i'),
      });
    }

    if (baths !== undefined) {
      await this.selectBedsOrBathsOptionBySection('Baths', baths, {
        exactCheckboxLabel: 'Exact baths',
        optionPattern: new RegExp(`^${baths}$`, 'i'),
      });
    }

    await this.commitOpenFilterMenu();
  }

  private async applyPropertyTypeFilterThroughUi(propertyTypes: PropertyTypeFilter[]) {
    await this.openFilterMenu('Property Type');

    for (const propertyType of propertyTypes) {
      await this.selectFilterOptionByText(
        new RegExp(`^${this.escapeRegExp(propertyType.label)}$`, 'i'),
      );
    }

    await this.commitOpenFilterMenu();
  }

  private async openFilterMenu(filterName: string) {
    const filterTrigger = this.page
      .getByRole('button', { name: new RegExp(filterName, 'i') })
      .filter({ visible: true })
      .first();

    await expect(
      filterTrigger,
      `Expected ${filterName} filter trigger to be visible.`,
    ).toBeVisible();
    await filterTrigger.click();
    this.logUiStep(`Opened ${filterName} filter menu`);
  }

  private async selectPriceBoundaryThroughUi(boundaryIndex: 0 | 1, priceValue: number) {
    const priceOverlay = this.getOpenFilterOverlay();
    const priceSelectors = priceOverlay
      .locator('[data-slot="form-control"], [role="combobox"], input, button')
      .filter({ visible: true });
    const targetSelector = priceSelectors.nth(boundaryIndex);

    await expect(
      targetSelector,
      `Expected ${boundaryIndex === 0 ? 'minimum' : 'maximum'} price selector to be visible.`,
    ).toBeVisible();
    await targetSelector.click();
    await this.selectPriceOptionByValue(priceValue);
  }

  private async selectFilterOptionByText(text: string | RegExp) {
    const openOverlay = this.getOpenFilterOverlay();
    const option = openOverlay
      .getByRole('option', { name: text })
      .or(openOverlay.getByRole('menuitemradio', { name: text }))
      .or(openOverlay.getByRole('radio', { name: text }))
      .or(openOverlay.getByRole('button', { name: text }))
      .or(openOverlay.getByText(text, { exact: false }))
      .filter({ visible: true })
      .first();

    await expect(option, `Expected filter option ${String(text)} to be visible.`).toBeVisible();
    await option.click();
    this.logUiStep(`Selected filter option: ${String(text)}`);
  }

  private async selectPriceOptionByValue(priceValue: number) {
    const openOverlay = this.getOpenFilterOverlay();
    const radioInput = openOverlay.locator(`input[type="radio"][value="${priceValue}"]`).first();
    const radioLabel = openOverlay.locator('label', { has: radioInput }).first();
    const fallbackOption = openOverlay
      .getByText(this.formatPriceCompact(priceValue), { exact: true })
      .or(openOverlay.getByText(this.formatPrice(priceValue), { exact: true }))
      .filter({ visible: true })
      .first();

    if (await radioLabel.isVisible().catch(() => false)) {
      await radioLabel.click();
      this.logUiStep(`Selected price option value: ${priceValue}`);
      return;
    }

    await expect(
      fallbackOption,
      `Expected price option ${priceValue} to be visible in the open price menu.`,
    ).toBeVisible();
    await fallbackOption.click();
    this.logUiStep(`Selected price option fallback: ${priceValue}`);
  }

  private async assertFiltersOverviewReflectsSelection(filters: UiSearchThresholdFilter) {
    const filtersButton = this.page
      .getByRole('button', { name: /Filters/i })
      .filter({ visible: true })
      .first();

    await expect(
      filtersButton,
      'Expected Filters button to be visible before opening filter overview.',
    ).toBeVisible();
    await filtersButton.click();

    const openOverlay = this.getOpenFilterOverlay();

    if (filters.priceMin !== undefined) {
      await this.expectPriceInputValueInOverview(filters.priceMin);
    }

    if (filters.priceMax !== undefined) {
      await this.expectPriceInputValueInOverview(filters.priceMax);
    }

    if (filters.beds !== undefined) {
      await expect(
        openOverlay.getByText(new RegExp(`\\b${filters.beds}\\+?\\b`, 'i')).first(),
      ).toBeVisible();
    }

    if (filters.baths !== undefined) {
      await expect(
        openOverlay.getByText(new RegExp(`\\b${filters.baths}\\b`, 'i')).first(),
      ).toBeVisible();
    }

    if (filters.propertyTypes?.length) {
      for (const propertyType of filters.propertyTypes) {
        await expect(
          openOverlay.getByText(new RegExp(this.escapeRegExp(propertyType.label), 'i')).first(),
          `Expected Filters overview to show property type "${propertyType.label}".`,
        ).toBeVisible();
      }
    }

    await this.page.keyboard.press('Escape');
  }

  private async expectPriceInputValueInOverview(price: number) {
    const openOverlay = this.getOpenFilterOverlay();
    const expectedValue = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 0,
    }).format(price);

    await expect
      .poll(
        async () => {
          const values = await openOverlay
            .locator('input')
            .evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

          return values.includes(expectedValue);
        },
        {
          message: `Expected Filters overview price input to include "${expectedValue}".`,
        },
      )
      .toBeTruthy();
  }

  private async selectBedsOrBathsOptionBySection(
    sectionLabel: 'Beds' | 'Baths',
    minimumValue: number,
    options: { exactCheckboxLabel: 'Exact beds' | 'Exact baths'; optionPattern: RegExp },
  ) {
    const openOverlay = this.getOpenFilterOverlay();
    const exactCheckbox = openOverlay.getByRole('checkbox', { name: options.exactCheckboxLabel });
    const section = exactCheckbox.locator('xpath=ancestor::*[@data-slot="form-item"][1]');

    if ((await exactCheckbox.getAttribute('aria-checked')) !== 'true') {
      await exactCheckbox.click();
      this.logUiStep(`Enabled ${options.exactCheckboxLabel.toLowerCase()}`);
    }

    const option = section.getByRole('button', { name: options.optionPattern });

    await expect(
      option,
      `Expected ${sectionLabel} option ${minimumValue} to be visible.`,
    ).toBeVisible();
    await option.click();
    this.logUiStep(`Selected ${sectionLabel.toLowerCase()} option: ${minimumValue}`);
  }

  private async commitOpenFilterMenu() {
    const applyButton = this.page
      .getByRole('button', { name: /^(Apply|Show homes|See homes|Done)$/i })
      .filter({ visible: true })
      .first();

    if (await applyButton.isVisible().catch(() => false)) {
      await applyButton.click();
      this.logUiStep('Committed filter menu with apply/done button');
    } else {
      await this.page.keyboard.press('Escape');
      this.logUiStep('Closed filter menu with Escape');
    }
  }

  private async assertSearchUrlContainsParams(expectedParams: Record<string, string | string[]>) {
    await expect
      .poll(
        () => {
          const url = new URL(this.page.url());

          return Object.entries(expectedParams).every(([key, value]) => {
            if (Array.isArray(value)) {
              const actualValues = url.searchParams
                .getAll(key)
                .flatMap((actualValue) => actualValue.split(',').map((item) => item.trim()));

              return value.every((expectedValue) => actualValues.includes(expectedValue));
            }

            return url.searchParams.get(key) === value;
          });
        },
        {
          message: `Expected search URL to include ${JSON.stringify(expectedParams)}.`,
        },
      )
      .toBeTruthy();
  }

  private async waitForVisibleCardsOrNoResults(timeout: number) {
    const noResultsHeading = this.page
      .getByRole('heading', {
        name: /didn.t find any homes matching your search|No properties found in this area/i,
      })
      .first();
    const realPropertyCard = this.visiblePropertyCards()
      .filter({ hasText: /\$\d[\d,.KM]*|beds?|baths?/i })
      .first();

    await expect(
      realPropertyCard.or(noResultsHeading).first(),
      'Expected filtered results to show real property cards or a no-results message.',
    ).toBeVisible({ timeout });
  }

  private logUiStep(message: string) {
    console.info(`[Search UI] ${message}\n\n${this.page.url()}\n`);
  }

  private getOpenFilterOverlay() {
    return this.page
      .locator('[role="dialog"], [role="menu"], [data-radix-popper-content-wrapper]')
      .filter({ visible: true })
      .last();
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private async getPropertyCardSummary(propertyCard: Locator) {
    const text = (await propertyCard.innerText()).replace(/\s+/g, ' ').trim();
    const propertyLinkText = (await propertyCard.getByRole('link').last().innerText())
      .replace(/\s+/g, ' ')
      .trim();
    const priceMatch = propertyLinkText.match(/\$([\d,]+)/);
    const bedMatch = propertyLinkText.match(/(\d+(?:\.\d+)?)\s*(?:bd|beds?)\b/i);
    const bathMatch = propertyLinkText.match(/(\d+(?:\.\d+)?)\s*(?:ba|baths?)\b/i);

    return {
      baths: bathMatch ? Number(bathMatch[1]) : null,
      beds: bedMatch ? Number(bedMatch[1]) : null,
      price: priceMatch ? Number(priceMatch[1]!.replace(/,/g, '')) : null,
      text: propertyLinkText || text,
    };
  }

  private async assertPropertyDetailPagesMatchPropertyType(
    propertyCards: Locator[],
    propertyTypes: PropertyTypeFilter[],
  ) {
    const searchResultsUrl = this.page.url();
    const sampledPropertyCards = propertyCards.slice(0, Math.min(propertyCards.length, 3));
    const listingTargets: { href: string; identifier: PropertyIdentifier }[] = [];

    for (const propertyCard of sampledPropertyCards) {
      const propertyDetailUrl = await this.getPropertyDetailUrl(propertyCard);

      if (!propertyDetailUrl) {
        throw new Error('Expected visible property card to include a property detail link.');
      }

      listingTargets.push({
        href: new URL(propertyDetailUrl, this.page.url()).href,
        identifier: await this.getPropertyIdentifier(propertyCard),
      });
    }

    for (const [index, listingTarget] of listingTargets.entries()) {
      this.logUiStep(
        `Validate listing detail property type ${index + 1}/${listingTargets.length}: ${propertyTypes
          .map(({ label }) => label)
          .join(', ')}`,
      );
      await this.openListingUrlAndWait(listingTarget.href, listingTarget.identifier);
      await this.expectListingPagePropertyType(propertyTypes, listingTarget.href);
    }

    await this.gotoSearchResultsAndWaitForFreshResults(
      searchResultsUrl,
      FILTER_SEARCH_RESULTS_SETTLE_TIMEOUT_MS,
    );
  }

  private async openListingUrlAndWait(
    propertyDetailUrl: string,
    propertyIdentifier?: PropertyIdentifier,
  ) {
    await this.page.goto(propertyDetailUrl);
    await this.page.waitForLoadState('domcontentloaded');

    const listingReadySignal = this.page
      .getByText(/\$\s?\d[\d,]*/)
      .or(this.listingTourCta())
      .or(this.listingMakeOfferCta())
      .or(this.listingSignBuyerAgreementCta())
      .first();

    await expect(
      listingReadySignal,
      `Expected property listing page to load: ${propertyDetailUrl}`,
    ).toBeVisible({
      timeout: 30000,
    });

    if (propertyIdentifier?.titleOrAddress) {
      const addressLead = propertyIdentifier.titleOrAddress.split(',')[0]!.trim();
      await expect(
        this.page.locator('body'),
        `Expected listing page to contain the selected property address lead "${addressLead}".`,
      )
        .toContainText(addressLead, { timeout: 20000 })
        .catch(() => undefined);
    }
  }

  private async expectListingPagePropertyType(
    propertyTypes: PropertyTypeFilter[],
    propertyDetailUrl: string,
  ) {
    const expectedPatterns = propertyTypes.flatMap((propertyType) =>
      this.propertyTypeDetailPatterns(propertyType),
    );

    await expect
      .poll(
        async () => {
          const bodyText = (await this.page.locator('body').innerText())
            .replace(/\s+/g, ' ')
            .trim();

          return expectedPatterns.some((pattern) => pattern.test(bodyText));
        },
        {
          message: `Expected listing detail page ${propertyDetailUrl} to expose one selected property type: ${propertyTypes
            .map(({ value }) => value)
            .join(', ')}.`,
          timeout: 20000,
        },
      )
      .toBe(true);
  }

  private propertyTypeDetailPatterns(propertyType: PropertyTypeFilter) {
    if (propertyType.value === 'Single Family Residence') {
      return [/Single Family Residence/i, /Single Family/i];
    }

    if (propertyType.value === 'Condominium') {
      return [/Condominium/i, /\bCondo\b/i];
    }

    return [new RegExp(this.escapeRegExp(propertyType.value), 'i')];
  }

  private escapeCssString(value: string) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }
}
