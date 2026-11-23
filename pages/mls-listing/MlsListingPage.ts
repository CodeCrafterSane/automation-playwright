import { random } from '../../utils/random';
import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import SearchPage, { type SearchLocation } from '../search/SearchPage';

export type MlsStateCode = 'FL' | 'GA';

export type MlsLocation = SearchLocation & {
  stateCode: MlsStateCode;
};

export type ListingContext = {
  location: string;
  propertyUrl: string;
};

export type PropertyCandidate = {
  card: Locator;
  url: string;
};

export type MlsRunPlan = {
  remainingLocations: Record<MlsStateCode, MlsLocation[]>;
  stateOrder: MlsStateCode[];
  stateTargets: Record<MlsStateCode, number>;
};

export type MlsRunResult = {
  complianceFailures: string[];
  searchedLocations: string[];
  testedLocations: string[];
  testedPropertyUrls: Set<string>;
};

const FLORIDA_LOCATIONS: MlsLocation[] = [
  location('Miami', 'Florida', 'FL'),
  location('Jacksonville', 'Florida', 'FL'),
  location('Pensacola', 'Florida', 'FL'),
  location('Tallahassee', 'Florida', 'FL'),
  location('Naples', 'Florida', 'FL'),
  location('Key West', 'Florida', 'FL'),
  location('Panama City', 'Florida', 'FL'),
  location('Gainesville', 'Florida', 'FL'),
  location('Melbourne', 'Florida', 'FL'),
  location('Fort Myers', 'Florida', 'FL'),
];

const GEORGIA_LOCATIONS: MlsLocation[] = [
  location('Albany', 'Georgia', 'GA'),
  location('Columbus', 'Georgia', 'GA'),
  location('Savannah', 'Georgia', 'GA'),
  location('Valdosta', 'Georgia', 'GA'),
  location('Dalton', 'Georgia', 'GA'),
  location('Brunswick', 'Georgia', 'GA'),
  location('Hinesville', 'Georgia', 'GA'),
  location('Milledgeville', 'Georgia', 'GA'),
  location('Tifton', 'Georgia', 'GA'),
  location('Clayton', 'Georgia', 'GA'),
];

const REQUIRED_LABELS = [
  'Listing presented by:',
  'Last checked:',
  'Listing updated:',
  'Listed by:',
  'Listing data source:',
  'Data source copyright:',
] as const;

const INVALID_PLACEHOLDER_PATTERN =
  /(?:\bundefined\b|\bnull\b|\[object Object\]|\bNaN\b|Invalid Date|{{[^{}]+}}|\$\{[^{}]+})/i;
const PHONE_PATTERN = /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g;
const DISCLOSURE_MEANING_PATTERN =
  /\b(?:[A-Z]*MLS|IDX|multiple listing|listing data|data relating to real estate|broker reciprocity|permitted use|non-commercial use|data (?:accuracy|accurate|reliability)|accuracy of (?:the )?(?:data|information)|information[^.]{0,80}\baccurate)\b/i;
const PLACEHOLDER_VALUE_PATTERN = /^(?:N\/?A|NA|none|unknown|unavailable|undefined|null|-+)$/i;
const PROPERTY_ADDRESS_PATTERN = /\b(?:FL|GA|Florida|Georgia)\s+\d{5}(?:-\d{4})?\b/i;

function location(city: string, state: string, stateCode: MlsStateCode): MlsLocation {
  return {
    label: `${city}, ${stateCode}`,
    inputValue: new RegExp(city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    params: { city, state, state_abbr: stateCode },
    stateCode,
  };
}

function shuffle<T>(values: readonly T[]) {
  const shuffled = [...values];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex]!, shuffled[index]!];
  }

  return shuffled;
}

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeUrl(value: string, baseUrl: string) {
  const url = new URL(value, baseUrl);
  url.hash = '';
  url.searchParams.sort();
  return url.toString().replace(/\/$/, '');
}

function isValidNamedValue(value: string) {
  const normalized = normalizeText(value).replace(/^[\s,;:|\-]+|[\s,;:|\-]+$/g, '');

  return (
    normalized.length > 1 &&
    !PLACEHOLDER_VALUE_PATTERN.test(normalized) &&
    !/^\+?[\d\s().-]+$/.test(normalized) &&
    /[A-Za-z]/.test(normalized)
  );
}

function parseFreshnessHours(rawValue: string, now = new Date()) {
  const value = normalizeText(rawValue).toLowerCase();

  if (/^(?:just now|moments? ago)$/.test(value)) return 0;

  const relativeMatch = value.match(
    /(?:about\s+|approximately\s+|less than\s+)?(an?|one|\d+(?:\.\d+)?)\s*(minute|hour|day)s?\s*ago/,
  );

  if (relativeMatch) {
    const amount = /^(?:a|an|one)$/.test(relativeMatch[1]!) ? 1 : Number(relativeMatch[1]);
    const unit = relativeMatch[2];

    if (unit === 'minute') return amount / 60;
    if (unit === 'hour') return amount;
    return amount * 24;
  }

  const timestamp = Date.parse(rawValue);
  if (Number.isNaN(timestamp)) return undefined;

  return (now.getTime() - timestamp) / 3_600_000;
}

function parseListedBy(rawValue: string) {
  const value = rawValue.replace(/\u00a0/g, ' ').trim();
  const segments = value
    .split(/\n+|\s*[|•·]\s*/)
    .map((segment) => normalizeText(segment))
    .filter(Boolean);
  const firstSegment = segments[0] ?? '';
  const firstPhoneIndex = firstSegment.search(PHONE_PATTERN);
  PHONE_PATTERN.lastIndex = 0;
  const agent = normalizeText(firstPhoneIndex >= 0 ? firstSegment.slice(0, firstPhoneIndex) : firstSegment)
    .replace(/^[\s,;:|\-]+|[\s,;:|\-]+$/g, '');
  let brokerageCandidates = segments.slice(1);

  if (brokerageCandidates.length === 0) {
    const phoneMatch = PHONE_PATTERN.exec(value);
    PHONE_PATTERN.lastIndex = 0;

    if (phoneMatch) {
      brokerageCandidates = [value.slice((phoneMatch.index ?? 0) + phoneMatch[0].length)];
    } else {
      brokerageCandidates = firstSegment.split(/\s+[-–—;,]\s+/).slice(1);
    }
  }

  const brokerage = brokerageCandidates
    .map((candidate) =>
      normalizeText(
        candidate
          .replace(PHONE_PATTERN, '')
          .replace(/\b(?:office|code)\s*#?:?\s*[A-Z0-9-]+/gi, '')
          .replace(/\s*,?\s*#[A-Z0-9-]+.*$/i, ''),
      )
        .replace(/^[\s,;:|\-]+|[\s,;:|\-]+$/g, ''),
    )
    .find(isValidNamedValue);
  PHONE_PATTERN.lastIndex = 0;

  return { agent, brokerage };
}

export default class MlsListingPage {
  private readonly searchPage: SearchPage;
  private cachedAttributionContainer?: Locator;
  private cachedListedByValue?: string;

  constructor(private readonly page: Page) {
    this.searchPage = new SearchPage(page);
  }

  createRunPlan(): MlsRunPlan {
    const floridaTarget = random() < 0.5 ? 2 : 3;
    const stateTargets: Record<MlsStateCode, number> = {
      FL: floridaTarget,
      GA: 5 - floridaTarget,
    };

    return {
      remainingLocations: {
        FL: shuffle(FLORIDA_LOCATIONS),
        GA: shuffle(GEORGIA_LOCATIONS),
      },
      stateOrder: shuffle([
        ...Array<MlsStateCode>(stateTargets.FL).fill('FL'),
        ...Array<MlsStateCode>(stateTargets.GA).fill('GA'),
      ]),
      stateTargets,
    };
  }

  createRunResult(): MlsRunResult {
    return {
      complianceFailures: [],
      searchedLocations: [],
      testedLocations: [],
      testedPropertyUrls: new Set<string>(),
    };
  }

  logRunPlan(plan: MlsRunPlan) {
    console.info(
      `[MLS compliance] Randomized target distribution: ${plan.stateTargets.FL} Florida + ${plan.stateTargets.GA} Georgia.`,
    );
  }

  async openPublicSearchFromLoggedOutState() {
    await this.ensureLoggedOut();

    const topNavigationSearch = this.page
      .locator('#navbar')
      .getByRole('link', { name: 'Search', exact: true })
      .or(this.page.locator('header, nav').getByRole('link', { name: 'Search', exact: true }))
      .filter({ visible: true })
      .first();

    await expect(topNavigationSearch, 'Expected Search in the public top navigation.').toBeVisible();
    await topNavigationSearch.click();
    await expect(this.page).toHaveURL(/\/search(?:[/?#]|$)/);
    await expect(this.locationInput()).toBeVisible();
    await expect(
      this.page
        .getByRole('button', { name: /^(?:log ?in|sign up)$/i })
        .or(this.page.getByRole('link', { name: /^(?:log ?in|sign up)$/i }))
        .filter({ visible: true })
        .first(),
      'Expected a public authentication entry point on unauthenticated Search.',
    ).toBeVisible();
    await expect(this.logoutAction(), 'Expected Search to remain in unauthenticated/public state.').toBeHidden();
  }

  async resetSearch() {
    await this.page.goto(`/search?_mls_reset=${Date.now()}`);
    await this.page.waitForLoadState('domcontentloaded');

    const locationInput = this.locationInput();
    const clearButton = this.visibleClearButton();

    await expect(locationInput, 'Expected the public Search location input to be ready.').toBeVisible();
    const clearBecameVisible = await clearButton
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(() => true)
      .catch(() => false);

    if (clearBecameVisible) {
      await clearButton.click();
    }

    await locationInput.fill('');
    await expect(
      this.page.getByRole('heading', { name: /zoom in or select a state to see homes/i }),
      'Expected the public Search page to return to its no-location default state.',
    ).toBeVisible();
    await this.page.evaluate(() => window.history.replaceState(window.history.state, '', '/search'));

    await expect(this.page, 'Expected to end in the default Search route.').toHaveURL(
      /\/search\/?(?:#.*)?$/,
    );
    await expect(locationInput, 'Expected no previous location to remain active.').toHaveValue('');
    await expect(clearButton, 'Expected no previous filters to remain active.').toBeHidden();
  }

  async findPropertyCandidate(
    selectedLocation: MlsLocation,
    testedPropertyUrls: Set<string>,
  ): Promise<PropertyCandidate | undefined> {
    console.info(`[MLS compliance] Searching unused location: ${selectedLocation.label}`);

    try {
      await this.searchPage.searchLocationThroughUi(selectedLocation);
      await this.searchPage.waitForSearchResultsToSettle(60_000);
    } catch (error) {
      console.info(
        `[MLS compliance] Skipping ${selectedLocation.label}; search did not produce a settled result: ${error instanceof Error ? error.message : String(error)}`,
      );
      return undefined;
    }

    const candidates = await this.visibleUniquePropertyCandidates(testedPropertyUrls);

    if (candidates.length === 0) {
      console.info(
        `[MLS compliance] Skipping ${selectedLocation.label}; no unused property results were available.`,
      );
      return undefined;
    }

    const selectedProperty = candidates[0]!;
    console.info(
      `[MLS compliance] Selected property: ${selectedLocation.label} -> ${selectedProperty.url}`,
    );
    return selectedProperty;
  }

  async openListing(candidate: PropertyCandidate, testedPropertyUrls: Set<string>) {
    await this.searchPage.openListingForProperty(candidate.card);
    const propertyUrl = normalizeUrl(this.page.url(), this.page.url());

    expect(
      testedPropertyUrls.has(propertyUrl),
      `Expected selected property URL to be unique: ${propertyUrl}`,
    ).toBe(false);

    return propertyUrl;
  }

  async validateAllComplianceChecks(context: ListingContext, testInfo: TestInfo) {
    this.cachedAttributionContainer = undefined;
    this.cachedListedByValue = undefined;
    const failures: string[] = [];
    const checks: Array<[string, () => Promise<void>]> = [
      ['1. Property page loads successfully', () => this.expectPropertyPageLoads()],
      ['2. Listing data was checked within 12 hours', () => this.expectFreshnessWithinTwelveHours()],
      ['3. Listing agent name is displayed', () => this.expectListingAgent()],
      ['4. Listing brokerage is displayed', () => this.expectListingBrokerage()],
      ['5. MLS data source is displayed', () => this.expectMlsDataSource()],
      ['6. Complete property address is displayed', () => this.expectCompleteAddress()],
      ['7. Listing price is displayed and valid', () => this.expectValidPrice()],
      ['8. Required attribution block is complete', () => this.expectCompleteAttributionBlock()],
      ['9. MLS disclaimer content is displayed', () => this.expectMeaningfulDisclaimer()],
      ['10. MLS disclaimer is visible', () => this.expectVisibleDisclaimer()],
      ['11. MLS copyright year is current', () => this.expectCurrentCopyrightYear()],
      ['12. MLS logo or source branding loads correctly', () => this.expectSourceBranding()],
      ['13. Listing contact information is displayed', () => this.expectListingContact()],
      ['14. No broken placeholders appear in MLS information', () => this.expectNoBrokenPlaceholders()],
    ];

    for (const [name, action] of checks) {
      await this.runComplianceCheck(name, action, context, testInfo, failures);
    }

    console.info(
      `[MLS compliance] Completed all 14 checks with ${failures.length} failure(s): ${context.location} -> ${context.propertyUrl}`,
    );
    return failures;
  }

  async attachFailureDiagnostics(testInfo: TestInfo, context: ListingContext, error: unknown) {
    const errorText = error instanceof Error ? error.stack ?? error.message : String(error);
    const diagnostics = [
      `Selected location: ${context.location}`,
      `Selected property URL: ${context.propertyUrl}`,
      `Current URL: ${this.page.url()}`,
      `Original failure (includes the exact assertion line and locator/action):\n${errorText}`,
      'Recommended fix: inspect the failing exact label/value in the attribution block and align the deployed MLS data or stable data-testid without weakening the required label.',
    ].join('\n\n');

    console.error(`[MLS compliance failure]\n${diagnostics}`);
    await testInfo.attach('mls-compliance-failure.txt', {
      body: Buffer.from(diagnostics),
      contentType: 'text/plain',
    });
  }

  expectRunCompleted(result: MlsRunResult) {
    expect(
      result.testedLocations,
      `Expected five unique locations after exhausting the fixed pool. Searched: ${result.searchedLocations.join(', ') || 'none'}. Property URLs found: ${[...result.testedPropertyUrls].join(', ') || 'none'}.`,
    ).toHaveLength(5);
    expect(new Set(result.testedLocations).size, 'Expected no location to be reused.').toBe(5);
    expect(result.testedPropertyUrls.size, 'Expected five unique property listing pages.').toBe(5);

    const testedFlorida = result.testedLocations.filter((value) => value.endsWith(', FL')).length;
    const testedGeorgia = result.testedLocations.filter((value) => value.endsWith(', GA')).length;
    expect(
      [testedFlorida, testedGeorgia].sort(),
      'Expected the tested location distribution to be either 2 FL + 3 GA or 3 FL + 2 GA.',
    ).toEqual([2, 3]);
    expect(
      result.complianceFailures,
      `Expected all 14 MLS compliance checks to pass on every listing. Failures:\n\n${result.complianceFailures.join('\n\n')}`,
    ).toEqual([]);
  }

  logRunResult(result: MlsRunResult) {
    console.info(`[MLS compliance] Tested locations: ${result.testedLocations.join(', ')}`);
    console.info(`[MLS compliance] Tested property URLs:\n${[...result.testedPropertyUrls].join('\n')}`);
  }

  private async runComplianceCheck(
    name: string,
    action: () => Promise<void>,
    context: ListingContext,
    testInfo: TestInfo,
    failures: string[],
  ) {
    console.info(`[MLS compliance] START ${name} | ${context.location} | ${context.propertyUrl}`);

    await test.step(name, async () => {
      try {
        await action();
        console.info(`[MLS compliance] PASS  ${name} | ${context.location}`);
      } catch (error) {
        const errorText = error instanceof Error ? error.stack ?? error.message : String(error);
        failures.push(`${name}\n${errorText}`);
        console.error(`[MLS compliance] FAIL  ${name} | ${context.location}`);
        await this.attachFailureDiagnostics(testInfo, context, error);
      }
    });
  }

  private async expectPropertyPageLoads() {
    const pathname = new URL(this.page.url()).pathname;
    expect(pathname, 'Expected a property URL rather than an HTTP error route.').not.toMatch(
      /^\/(?:404|500|not-found|error)(?:\/|$)/i,
    );

    const body = this.page.locator('body');
    await expect(body, 'Expected a non-blank property page.').toBeVisible();
    await expect(body).not.toHaveText(/^\s*$/);
    await expect(body, 'Expected the selected property to remain available.').not.toContainText(
      /property (?:is )?(?:unavailable|no longer available)|listing (?:is )?(?:unavailable|removed)|page not found/i,
    );
    await expect(this.primaryAddress(), 'Expected the main property address heading to be visible.').toBeVisible();
    await expect(this.primaryPrice(), 'Expected the primary listing price to be visible.').toBeVisible();
    await expect(
      this.propertyImage().or(this.propertyDetails()).first(),
      'Expected at least one property image or property-details section.',
    ).toBeVisible();
  }

  private async expectFreshnessWithinTwelveHours() {
    const container = await this.attributionContainer();
    const { row, value } = await this.valueForLabel(
      container,
      'Last checked:',
      'listing-last-checked',
    );
    await row.scrollIntoViewIfNeeded();
    await expect(
      this.exactVisibleText(container, 'Last checked:'),
      'Expected exact visible label "Last checked:" before evaluating freshness.',
    ).toBeVisible();
    const ageInHours = parseFreshnessHours(value);

    console.info(
      `[MLS freshness] Last checked: "${value}" | parsed age: ${ageInHours === undefined ? 'unparseable' : `${ageInHours.toFixed(2)} hours`} | required: <= 12 hours`,
    );
    expect(ageInHours, `Expected the platform last checked value "${value}" to be parseable.`).toBeDefined();
    expect(ageInHours!, 'Expected the platform last checked time not to be in the future.').toBeGreaterThanOrEqual(
      -5 / 60,
    );
    expect(
      ageInHours!,
      `Expected the platform last checked age for "${value}" to be 12 hours or less.`,
    ).toBeLessThanOrEqual(12);
  }

  private async expectListingAgent() {
    const { agent } = parseListedBy(await this.listedByValue());
    expect(
      isValidNamedValue(agent),
      'Expected the first named value after "Listed by:" to be an agent name.',
    ).toBe(true);
  }

  private async expectListingBrokerage() {
    const { brokerage } = parseListedBy(await this.listedByValue());
    expect(
      typeof brokerage === 'string' && isValidNamedValue(brokerage),
      'Expected a non-placeholder brokerage name after the agent separator in the "Listed by:" row.',
    ).toBe(true);
  }

  private async expectMlsDataSource() {
    const { value } = await this.valueForLabel(
      await this.attributionContainer(),
      'Listing data source:',
      'listing-data-source',
    );
    expect(isValidNamedValue(value), 'Expected a non-placeholder MLS source value.').toBe(true);
  }

  private async expectCompleteAddress() {
    const address = this.primaryAddress();
    await expect(address, 'Expected the primary property-address heading.').toBeVisible();
    const text = normalizeText(await address.innerText());

    expect(text, 'Expected a street number and street name.').toMatch(/\b\d+[A-Za-z-]*\s+[A-Za-z0-9]/);
    expect(text, 'Expected city, state, and five-digit ZIP in the complete address.').toMatch(
      /,?\s*[A-Za-z .'-]+,?\s*(?:FL|GA|Florida|Georgia)\s+\d{5}(?:-\d{4})?\b/i,
    );
    expect(text).not.toMatch(/\b(?:N\/?A|unavailable|undefined|null)\b/i);
  }

  private async expectValidPrice() {
    const price = this.primaryPrice();
    await expect(price, 'Expected the primary visible listing price near the property summary.').toBeVisible();
    const rawPrice = normalizeText(await price.innerText());
    const numericPrice = Number(rawPrice.replace(/[$,\s]/g, ''));

    expect(Number.isFinite(numericPrice), `Expected listing price "${rawPrice}" to be parseable.`).toBe(true);
    expect(numericPrice, 'Expected listing price to be greater than zero.').toBeGreaterThan(0);
  }

  private async expectCompleteAttributionBlock() {
    const container = await this.attributionContainer();

    for (const label of REQUIRED_LABELS) {
      await expect(
        this.exactVisibleText(container, label),
        `Expected exact attribution label "${label}".`,
      ).toBeVisible();
    }

    const freshness = await this.valueForLabel(container, 'Last checked:', 'listing-last-checked');
    const listedBy = parseListedBy(await this.listedByValue());
    const source = await this.valueForLabel(container, 'Listing data source:', 'listing-data-source');
    const disclosure = await this.disclosureParagraph(container);

    expect(freshness.value).not.toBe('');
    expect(isValidNamedValue(listedBy.agent)).toBe(true);
    expect(
      typeof listedBy.brokerage === 'string' && isValidNamedValue(listedBy.brokerage),
    ).toBe(true);
    expect(isValidNamedValue(source.value)).toBe(true);
    expect(normalizeText(await disclosure.innerText()), 'Expected disclosure text below copyright.').not.toBe(
      '',
    );
  }

  private async expectMeaningfulDisclaimer() {
    const disclosure = await this.disclosureParagraph(await this.attributionContainer());
    const text = normalizeText(await disclosure.innerText());

    expect(text.length, 'Expected a meaningful MLS disclosure paragraph.').toBeGreaterThan(30);
    expect(text, 'Expected disclosure to discuss MLS/listing data, use, or accuracy.').toMatch(
      DISCLOSURE_MEANING_PATTERN,
    );
    expect(text, 'Expected disclosure not to contain broken placeholder text.').not.toMatch(
      INVALID_PLACEHOLDER_PATTERN,
    );
  }

  private async expectVisibleDisclaimer() {
    const disclosure = await this.disclosureParagraph(await this.attributionContainer());
    await expect(disclosure, 'Expected the disclosure paragraph to be attached.').toBeAttached();
    await disclosure.scrollIntoViewIfNeeded();
    await expect(disclosure, 'Expected the disclosure paragraph to be visible.').toBeVisible();
    const box = await disclosure.boundingBox();

    expect(box, 'Expected the disclosure paragraph to have a bounding box.').not.toBeNull();
    expect(box!.width, 'Expected disclosure width to be greater than zero.').toBeGreaterThan(0);
    expect(box!.height, 'Expected disclosure height to be greater than zero.').toBeGreaterThan(0);
    expect(
      await disclosure.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
        return Boolean(hit && (hit === element || element.contains(hit) || hit.contains(element)));
      }),
      'Expected the disclosure paragraph not to be covered at its center point.',
    ).toBe(true);
  }

  private async expectCurrentCopyrightYear() {
    const { value } = await this.valueForLabel(
      await this.attributionContainer(),
      'Data source copyright:',
      'data-source-copyright',
    );
    const yearMatch = value.match(/\b(19|20)\d{2}\b/);

    expect(yearMatch, `Expected copyright value "${value}" to contain a four-digit year.`).not.toBeNull();
    expect(Number(yearMatch![0]), 'Expected the MLS copyright year to match the runtime year.').toBe(
      new Date().getFullYear(),
    );
    expect(value).not.toMatch(/{{\s*currentYear\s*}}/i);
  }

  private async expectSourceBranding() {
    const { row, value } = await this.valueForLabel(
      await this.attributionContainer(),
      'Listing data source:',
      'listing-data-source',
    );
    const logo = row.locator('[data-testid="listing-data-source-logo"], img').first();

    if (await logo.count()) {
      await expect(logo, 'Expected the configured MLS/source logo to be visible.').toBeVisible();
      const src = await logo.getAttribute('src');
      expect(src?.trim(), 'Expected the MLS/source logo src to be non-empty.').toBeTruthy();
      const dimensions = await logo.evaluate((image) => {
        const element = image as HTMLImageElement;
        return { naturalHeight: element.naturalHeight, naturalWidth: element.naturalWidth };
      });
      expect(dimensions.naturalWidth, 'Expected MLS/source logo naturalWidth > 0.').toBeGreaterThan(0);
      expect(dimensions.naturalHeight, 'Expected MLS/source logo naturalHeight > 0.').toBeGreaterThan(0);
      return;
    }

    expect(
      isValidNamedValue(value),
      'Expected an approved visible, non-placeholder source-text fallback when no source logo is configured.',
    ).toBe(true);
  }

  private async expectListingContact() {
    const { row } = await this.valueForLabel(await this.attributionContainer(), 'Listed by:');
    const rowText = await row.innerText();
    const candidates = rowText.match(PHONE_PATTERN) ?? [];
    PHONE_PATTERN.lastIndex = 0;
    const validPhones = candidates.filter((candidate) => {
      const digits = candidate.replace(/\D/g, '');
      return digits.length === 10 || (digits.length === 11 && digits.startsWith('1'));
    });

    expect(
      validPhones.length,
      `Expected at least one valid US agent/brokerage phone in the "Listed by:" row; found: ${candidates.join(', ') || 'none'}.`,
    ).toBeGreaterThan(0);
  }

  private async expectNoBrokenPlaceholders() {
    const container = await this.attributionContainer();
    const disclosure = await this.disclosureParagraph(container);
    const completeText = normalizeText(`${await container.innerText()} ${await disclosure.innerText()}`);

    expect(
      completeText,
      'Expected the complete MLS attribution and disclosure text not to contain broken placeholders.',
    ).not.toMatch(INVALID_PLACEHOLDER_PATTERN);
  }

  private async ensureLoggedOut() {
    await this.page.goto('/');
    await this.page.waitForLoadState('domcontentloaded');

    const directLogout = this.logoutAction().filter({ visible: true }).first();
    if (await directLogout.isVisible().catch(() => false)) {
      await directLogout.click();
      await this.page.waitForLoadState('domcontentloaded');
      return;
    }

    const profileMenu = this.page
      .getByRole('button', { name: /profile menu/i })
      .filter({ visible: true })
      .first();
    const placeholderProfile = profileMenu.filter({ hasText: /^\s*(?:YN|Your Name)\s*$/i });

    if (
      (await profileMenu.isVisible().catch(() => false)) &&
      !(await placeholderProfile.isVisible().catch(() => false))
    ) {
      await profileMenu.click();
      const menuLogout = this.page
        .getByRole('menuitem', { name: /(?:log|sign) out/i })
        .or(this.logoutAction())
        .filter({ visible: true })
        .first();

      await expect(menuLogout, 'Expected an authenticated profile menu to offer logout.').toBeVisible();
      await menuLogout.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  private async visibleUniquePropertyCandidates(testedPropertyUrls: Set<string>) {
    const cards = await this.searchPage.getVisiblePropertyCards(30);
    const candidates: PropertyCandidate[] = [];

    for (const card of cards) {
      const href = await card.getByRole('link').first().getAttribute('href');
      if (!href) continue;

      const url = normalizeUrl(href, this.page.url());
      if (!testedPropertyUrls.has(url) && !candidates.some((candidate) => candidate.url === url)) {
        candidates.push({ card, url });
      }
    }

    return shuffle(candidates);
  }

  private async attributionContainer() {
    if (this.cachedAttributionContainer) return this.cachedAttributionContainer;

    const startLabel = this.exactVisibleText(this.page, 'Listing presented by:');
    await expect(
      startLabel,
      'Expected the attribution block to begin with exact label "Listing presented by:".',
    ).toBeVisible();

    let candidate = startLabel.locator('xpath=..');

    for (let level = 0; level < 9; level += 1) {
      const candidateText = normalizeText(await candidate.innerText().catch(() => ''));
      if (REQUIRED_LABELS.every((label) => candidateText.includes(label))) {
        this.cachedAttributionContainer = candidate;
        return candidate;
      }
      candidate = candidate.locator('xpath=..');
    }

    throw new Error('Could not locate one complete attribution container containing all exact labels.');
  }

  private async listedByValue() {
    if (this.cachedListedByValue !== undefined) return this.cachedListedByValue;

    const row = await this.rowForLabel(await this.attributionContainer(), 'Listed by:');
    const rowText = (await row.innerText()).replace(/\u00a0/g, ' ').trim();
    const labelIndex = rowText.indexOf('Listed by:');
    this.cachedListedByValue = (
      labelIndex >= 0 ? rowText.slice(labelIndex + 'Listed by:'.length) : rowText
    ).trim();
    return this.cachedListedByValue;
  }

  private async disclosureParagraph(container: Locator) {
    const copyrightLabel = this.exactVisibleText(container, 'Data source copyright:');
    await expect(copyrightLabel, 'Expected exact label "Data source copyright:".').toBeVisible();

    const testIdDisclosure = container.locator('[data-testid="mls-disclaimer"]').first();
    if (await testIdDisclosure.count()) return testIdDisclosure;

    const copyrightRow = await this.rowForLabel(container, 'Data source copyright:');
    const followingParagraph = copyrightRow.locator(
      'xpath=following-sibling::*[1][self::p] | following-sibling::*[1]//p[1]',
    );
    await expect(
      followingParagraph,
      'Expected the first disclosure paragraph immediately below "Data source copyright:".',
    ).toBeAttached();
    return followingParagraph;
  }

  private async rowForLabel(scope: Page | Locator, label: string) {
    const exactLabel = this.exactVisibleText(scope, label);
    await expect(exactLabel, `Expected exact visible the platform label "${label}".`).toBeVisible();

    let candidate = exactLabel.locator('xpath=..');
    for (let level = 0; level < 5; level += 1) {
      const text = normalizeText(await candidate.innerText().catch(() => ''));
      const containsAnotherRequiredLabel = REQUIRED_LABELS.some(
        (requiredLabel) => requiredLabel !== label && text.includes(requiredLabel),
      );

      if (text.length > label.length && !containsAnotherRequiredLabel) return candidate;
      candidate = candidate.locator('xpath=..');
    }

    throw new Error(`Could not resolve the value row associated with exact label "${label}".`);
  }

  private async valueForLabel(scope: Page | Locator, label: string, preferredTestId?: string) {
    const row = await this.rowForLabel(scope, label);
    const preferredValue = preferredTestId
      ? scope.locator(`[data-testid="${preferredTestId}"]`).filter({ visible: true }).first()
      : undefined;
    const valueSource =
      preferredValue && (await preferredValue.isVisible().catch(() => false)) ? preferredValue : row;
    const text = normalizeText(await valueSource.innerText());
    const labelIndex = text.indexOf(label);
    const value = normalizeText(labelIndex >= 0 ? text.slice(labelIndex + label.length) : text);

    expect(value, `Expected a value associated with exact label "${label}".`).not.toBe('');
    return { row, value };
  }

  private exactVisibleText(scope: Page | Locator, label: string) {
    return scope.getByText(label, { exact: true }).filter({ visible: true }).first();
  }

  private primaryAddress() {
    return this.page
      .getByRole('heading')
      .filter({ hasText: PROPERTY_ADDRESS_PATTERN })
      .filter({ visible: true })
      .first();
  }

  private primaryPrice() {
    return this.page
      .getByText(/^\s*\$\s*[\d,]+(?:\.\d{2})?\s*$/)
      .filter({ visible: true })
      .first();
  }

  private propertyImage() {
    return this.page.locator('main img').filter({ visible: true }).first();
  }

  private propertyDetails() {
    return this.page
      .getByText(/\b(?:beds?|baths?|property details|home details)\b/i)
      .filter({ visible: true })
      .first();
  }

  private locationInput() {
    return this.page.getByPlaceholder('Enter zip code, county or city');
  }

  private visibleClearButton() {
    return this.page
      .getByRole('button', { name: 'Clear', exact: true })
      .filter({ visible: true })
      .first();
  }

  private logoutAction() {
    return this.page
      .getByRole('button', { name: /^(?:log|sign) out$/i })
      .or(this.page.getByRole('link', { name: /^(?:log|sign) out$/i }));
  }
}
