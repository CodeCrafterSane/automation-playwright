import { random } from '../../utils/random';
import { expect, Locator, Page, TestInfo } from '@playwright/test';
import fs from 'fs/promises';

type BrowsedUrlRecord = {
  context: string;
  error?: string;
  status?: number;
  url: string;
  selectedUrl?: string;
  redirected?: boolean;
};

type BrowseWarningRecord = {
  context: string;
  message: string;
  url: string;
};

type ListingFacts = {
  address?: string;
  beds?: string;
  baths?: string;
  prices?: string[];
  sqft?: string;
};

type SelectedListing = {
  facts: ListingFacts;
  href: string;
};

const stateNamesByCode: Record<string, string> = {
  al: 'Alabama',
  ak: 'Alaska',
  az: 'Arizona',
  ar: 'Arkansas',
  ca: 'California',
  co: 'Colorado',
  ct: 'Connecticut',
  de: 'Delaware',
  dc: 'District of Columbia',
  fl: 'Florida',
  ga: 'Georgia',
  hi: 'Hawaii',
  id: 'Idaho',
  il: 'Illinois',
  in: 'Indiana',
  ia: 'Iowa',
  ks: 'Kansas',
  ky: 'Kentucky',
  la: 'Louisiana',
  me: 'Maine',
  md: 'Maryland',
  ma: 'Massachusetts',
  mi: 'Michigan',
  mn: 'Minnesota',
  ms: 'Mississippi',
  mo: 'Missouri',
  mt: 'Montana',
  ne: 'Nebraska',
  nv: 'Nevada',
  nh: 'New Hampshire',
  nj: 'New Jersey',
  nm: 'New Mexico',
  ny: 'New York',
  nc: 'North Carolina',
  nd: 'North Dakota',
  oh: 'Ohio',
  ok: 'Oklahoma',
  or: 'Oregon',
  pa: 'Pennsylvania',
  ri: 'Rhode Island',
  sc: 'South Carolina',
  sd: 'South Dakota',
  tn: 'Tennessee',
  tx: 'Texas',
  ut: 'Utah',
  vt: 'Vermont',
  va: 'Virginia',
  wa: 'Washington',
  wv: 'West Virginia',
  wi: 'Wisconsin',
  wy: 'Wyoming',
};

export default class BreadcrumbPage {
  constructor(private page: Page) {}

  async validateCountyRange(
    testInfo: TestInfo,
    browseListingsStartPath: string,
    start: number,
    end: number,
  ) {
    testInfo.setTimeout(900000);

    const browsedUrls: BrowsedUrlRecord[] = [];
    const warnings: BrowseWarningRecord[] = [];
    let badUrls: string[] = [];

    try {
      const { browseStateName, countyUrls } = await this.collectCountyUrlsForState(
        browsedUrls,
        warnings,
        browseListingsStartPath,
      );
      const countyUrlsToValidate = countyUrls.slice(start, end);

      expect(countyUrlsToValidate.length, `No county URLs found in range ${start}-${end}`).toBeGreaterThan(0);

      console.log(
        `Validating county URLs ${start}-${end}. Running ${countyUrlsToValidate.length} of ${countyUrls.length}`,
      );

      badUrls = await this.validateUrlsOnNewPage(
        countyUrlsToValidate,
        browseStateName,
        browsedUrls,
        warnings,
      );

      this.reportBrokenUrls(badUrls);
    } finally {
      await this.attachBrowsedUrls(testInfo, browsedUrls, badUrls, warnings);
    }
  }

  async validateRandomCountySample(
    testInfo: TestInfo,
    browseListingsStartPath: string,
    sampleSize: number,
  ) {
    testInfo.setTimeout(900000);

    const browsedUrls: BrowsedUrlRecord[] = [];
    const warnings: BrowseWarningRecord[] = [];
    let badUrls: string[] = [];

    try {
      const { browseStateName, countyUrls } = await this.collectCountyUrlsForState(
        browsedUrls,
        warnings,
        browseListingsStartPath,
      );
      const countyUrlsToValidate = this.shuffle(countyUrls).slice(0, sampleSize);

      expect(countyUrlsToValidate.length, `No county URLs found for random sample of ${sampleSize}`).toBeGreaterThan(0);

      console.log(
        `Validating ${countyUrlsToValidate.length} random county URL(s) of ${countyUrls.length}`,
      );

      badUrls = await this.validateUrlsOnNewPage(
        countyUrlsToValidate,
        browseStateName,
        browsedUrls,
        warnings,
      );

      this.reportBrokenUrls(badUrls);
    } finally {
      await this.attachBrowsedUrls(testInfo, browsedUrls, badUrls, warnings);
    }
  }

  private async collectCountyUrlsForState(
    browsedUrls: BrowsedUrlRecord[],
    warnings: BrowseWarningRecord[],
    browseListingsStartPath: string,
  ) {
    const normalizedBrowseListingsStartPath = new URL(
      browseListingsStartPath,
      'https://example.com',
    ).pathname;
    const browseStateCode = this.getBrowseStateCode(normalizedBrowseListingsStartPath);
    const browseStateName = this.getStateName(browseStateCode);

    try {
      await this.page.goto(normalizedBrowseListingsStartPath, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
    } catch (error) {
      this.recordWarning(
        warnings,
        'start browse page',
        this.page.url(),
        `[browseAll] Failed to open state browse page for ${browseStateName}: ${this.formatUnknownError(
          error,
        )}`,
      );

      return { browseStateName, countyUrls: [] };
    }

    this.recordBrowsedUrl(browsedUrls, 'start browse page', this.page.url());

    await this.expectStateBrowsePageLoaded(browseStateName, warnings);

    const countyLinkSelector = `a[href*="/homes/"][href*="-county-${browseStateCode}"]`;
    let countyUrls: string[] = [];

    try {
      countyUrls = await this.collectPaginatedLinks(
        countyLinkSelector,
        new RegExp(`Browse Homes for Sale by County in ${this.escapeRegex(browseStateName)}`, 'i'),
      );
    } catch (error) {
      this.recordWarning(
        warnings,
        'state county links',
        this.page.url(),
        `[browseAll] Failed to collect county URLs for ${browseStateName}. Selector: ${countyLinkSelector}. Error: ${this.formatUnknownError(
          error,
        )}`,
      );
    }

    if (countyUrls.length === 0) {
      this.recordWarning(
        warnings,
        'state county links',
        this.page.url(),
        `[browseAll] No county URLs found for ${browseStateName}. Selector: ${countyLinkSelector}`,
      );
    }

    return { browseStateName, countyUrls };
  }

  private async validateUrlsOnNewPage(
    urls: string[],
    expectedStateName: string,
    browsedUrls: BrowsedUrlRecord[],
    warnings: BrowseWarningRecord[],
  ): Promise<string[]> {
    const badUrls: string[] = [];
    const validationPage = await this.page.context().newPage();

    try {
      for (const url of urls) {
        let activeContext = 'county page';

        try {
          const response = await validationPage.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: 30000,
          });

          const status = response?.status();
          let countyErrorUi = await this.getErrorUi(validationPage);

          if (!countyErrorUi) {
            await validationPage.waitForTimeout(1000);
            countyErrorUi = await this.getErrorUi(validationPage);
          }

          const countyErrorDetails = this.formatErrorDetails(status, countyErrorUi);

          this.recordBrowsedUrl(browsedUrls, 'county page', validationPage.url(), {
            error: countyErrorDetails ?? undefined,
            status,
          });

          if (countyErrorDetails) {
            this.recordFailedUrl(
              badUrls,
              `FAILED URL: ${url} | Context: county page | Current URL: ${validationPage.url()} | Error: ${countyErrorDetails}`,
            );
            continue;
          }

          activeContext = 'listing navigation from county page';

          const selectedListing = await this.clickRandomListing(
            validationPage,
            url,
            warnings,
            (href) => {
              this.recordBrowsedUrl(browsedUrls, 'selected listing link', href);
            },
          );

          if (!selectedListing) {
            this.recordBrowsedUrl(browsedUrls, 'county page listings', validationPage.url(), {
              error: 'No clickable listing found',
            });

            this.recordFailedUrl(
              badUrls,
              `FAILED URL: ${url} | Context: county page listings | Current URL: ${validationPage.url()} | Error: No clickable listing found`,
            );
            continue;
          }

          const listingHref = selectedListing.href;

          activeContext = 'property page';

          const listingErrorDetails = this.formatErrorDetails(
            undefined,
            await this.getErrorUi(validationPage),
          );

          this.recordBrowsedUrl(browsedUrls, 'property page', validationPage.url(), {
            selectedUrl: listingHref,
            redirected: this.normalizeUrl(listingHref) !== this.normalizeUrl(validationPage.url()),
            error: listingErrorDetails ?? undefined,
          });

          if (listingErrorDetails) {
            this.recordFailedUrl(
              badUrls,
              `FAILED LISTING: ${listingHref} | Context: property page | County URL: ${url} | Current URL: ${validationPage.url()} | Error: ${listingErrorDetails}`,
            );
            continue;
          }

          activeContext = 'property page content';
          await this.expectPropertyPageLoaded(
            validationPage,
            listingHref,
            selectedListing.facts,
            warnings,
          );

          activeContext = 'breadcrumb navigation from property page';

          const breadcrumbHref = await this.clickRandomPropertyBreadcrumb(
            validationPage,
            listingHref,
            expectedStateName,
            (href) => {
              this.recordBrowsedUrl(browsedUrls, 'selected breadcrumb link', href);
            },
          );

          activeContext = 'breadcrumb page';

          const breadcrumbErrorDetails = this.formatErrorDetails(
            undefined,
            await this.getErrorUi(validationPage),
          );

          this.recordBrowsedUrl(browsedUrls, 'breadcrumb page', validationPage.url(), {
            selectedUrl: breadcrumbHref,
            redirected:
              this.normalizeUrl(breadcrumbHref) !== this.normalizeUrl(validationPage.url()),
            error: breadcrumbErrorDetails ?? undefined,
          });

          if (breadcrumbErrorDetails) {
            this.recordFailedUrl(
              badUrls,
              `FAILED BREADCRUMB: ${breadcrumbHref} | Context: breadcrumb page | Listing URL: ${listingHref} | Current URL: ${validationPage.url()} | Error: ${breadcrumbErrorDetails}`,
            );
            continue;
          }

          activeContext = 'listing navigation from breadcrumb page';

          const secondSelectedListing = await this.clickRandomListing(
            validationPage,
            validationPage.url(),
            warnings,
            (href) => {
              this.recordBrowsedUrl(browsedUrls, 'selected breadcrumb listing link', href);
            },
          );

          if (!secondSelectedListing) {
            this.recordBrowsedUrl(browsedUrls, 'breadcrumb page listings', validationPage.url(), {
              error: 'No clickable listing found',
            });

            this.recordFailedUrl(
              badUrls,
              `FAILED URL: ${url} | Context: breadcrumb page listings | Current URL: ${validationPage.url()} | Error: No clickable listing found`,
            );
            continue;
          }

          const secondListingHref = secondSelectedListing.href;

          activeContext = 'property page from breadcrumb page';

          const secondListingErrorDetails = this.formatErrorDetails(
            undefined,
            await this.getErrorUi(validationPage),
          );

          this.recordBrowsedUrl(
            browsedUrls,
            'property page from breadcrumb page',
            validationPage.url(),
            {
              selectedUrl: secondListingHref,
              redirected:
                this.normalizeUrl(secondListingHref) !== this.normalizeUrl(validationPage.url()),
              error: secondListingErrorDetails ?? undefined,
            },
          );

          if (secondListingErrorDetails) {
            this.recordFailedUrl(
              badUrls,
              `FAILED LISTING: ${secondListingHref} | Context: property page from breadcrumb page | County URL: ${url} | Current URL: ${validationPage.url()} | Error: ${secondListingErrorDetails}`,
            );
            continue;
          }

          activeContext = 'property page content from breadcrumb page';
          await this.expectPropertyPageLoaded(
            validationPage,
            secondListingHref,
            secondSelectedListing.facts,
            warnings,
          );

          activeContext = 'second breadcrumb navigation from property page';

          const secondBreadcrumbHref = await this.clickRandomPropertyBreadcrumb(
            validationPage,
            secondListingHref,
            expectedStateName,
            (href) => {
              this.recordBrowsedUrl(browsedUrls, 'selected second breadcrumb link', href);
            },
          );

          activeContext = 'second breadcrumb page';

          const secondBreadcrumbErrorDetails = this.formatErrorDetails(
            undefined,
            await this.getErrorUi(validationPage),
          );

          this.recordBrowsedUrl(browsedUrls, 'second breadcrumb page', validationPage.url(), {
            selectedUrl: secondBreadcrumbHref,
            redirected:
              this.normalizeUrl(secondBreadcrumbHref) !== this.normalizeUrl(validationPage.url()),
            error: secondBreadcrumbErrorDetails ?? undefined,
          });

          if (secondBreadcrumbErrorDetails) {
            this.recordFailedUrl(
              badUrls,
              `FAILED SECOND BREADCRUMB: ${secondBreadcrumbHref} | Context: second breadcrumb page | Listing URL: ${secondListingHref} | Current URL: ${validationPage.url()} | Error: ${secondBreadcrumbErrorDetails}`,
            );
          }
        } catch (error) {
          const errorMessage = this.formatUnknownError(error);

          this.recordBrowsedUrl(browsedUrls, activeContext, validationPage.url(), {
            error: errorMessage,
          });

          this.recordFailedUrl(
            badUrls,
            `ERROR URL: ${url} | Context: ${activeContext} | Current URL: ${validationPage.url()} | Error: ${errorMessage}`,
          );
        }
      }
    } finally {
      await validationPage.close().catch(() => null);
    }

    return badUrls;
  }

  private async collectPaginatedLinks(
    linkSelector: string,
    paginationHeading?: RegExp,
  ): Promise<string[]> {
    const collectedUrls = new Set<string>();
    const paginationScope = paginationHeading
      ? this.page.getByRole('heading', { name: paginationHeading }).locator('xpath=..')
      : this.page.locator('body');

    while (true) {
      const beforeCount = collectedUrls.size;
      const links = await this.getLinks(this.page, linkSelector);
      links.forEach((link) => collectedUrls.add(link));

      const firstHrefBefore = await this.page
        .locator(linkSelector)
        .first()
        .getAttribute('href')
        .catch(() => null);

      const nextButton = paginationScope.getByRole('button', { name: 'Next', exact: true });

      if ((await nextButton.count()) === 0 || !(await nextButton.isVisible())) break;
      if (!(await nextButton.isEnabled())) break;

      await nextButton.click();

      await this.page
        .waitForFunction(
          ({ selector, previousHref }) => {
            const firstLink = document.querySelector(selector) as HTMLAnchorElement | null;
            return firstLink?.getAttribute('href') !== previousHref;
          },
          { selector: linkSelector, previousHref: firstHrefBefore },
          { timeout: 50000 },
        )
        .catch(() => null);

      const afterLinks = await this.getLinks(this.page, linkSelector);
      afterLinks.forEach((link) => collectedUrls.add(link));

      if (collectedUrls.size === beforeCount) break;
    }

    return [...collectedUrls];
  }

  private async expectStateBrowsePageLoaded(
    browseStateName: string,
    warnings: BrowseWarningRecord[],
  ) {
    const expectedHeading = this.page
      .getByRole('heading', {
        name: new RegExp(`^Homes for Sale in ${this.escapeRegex(browseStateName)}$`, 'i'),
      })
      .first();

    if (!(await expectedHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      this.recordWarning(
        warnings,
        'state browse heading',
        this.page.url(),
        `[browseAll] State browse heading not visible for ${browseStateName}`,
      );
    }

    const breadcrumb = this.page.getByRole('navigation', { name: /breadcrumb/i }).first();

    if (!(await breadcrumb.isVisible({ timeout: 5000 }).catch(() => false))) {
      this.recordWarning(
        warnings,
        'state browse breadcrumb',
        this.page.url(),
        `[browseAll] State browse breadcrumb not visible for ${browseStateName}`,
      );
      return;
    }

    const breadcrumbItems = await breadcrumb.locator('li').evaluateAll((items) =>
      items
        .map((item) => item.textContent?.trim().replace(/\s+/g, ' ') || '')
        .filter((text) => text.length > 0),
    );

    const hasExpectedBreadcrumb =
      /^Homes$/i.test(breadcrumbItems[0] || '') &&
      new RegExp(`^${this.escapeRegex(browseStateName)}$`, 'i').test(breadcrumbItems[1] || '');

    if (!hasExpectedBreadcrumb) {
      this.recordWarning(
        warnings,
        'state browse breadcrumb',
        this.page.url(),
        `[browseAll] State browse breadcrumb mismatch for ${browseStateName}. Found: ${breadcrumbItems.join(
          ' > ',
        )}`,
      );
    }
  }

  private async getLinks(page: Page, selector: string): Promise<string[]> {
    return page
      .locator(selector)
      .evaluateAll((elements) =>
        elements.map((element) => (element as HTMLAnchorElement).href).filter(Boolean),
      );
  }

  private async clickRandomListing(
    page: Page,
    countyUrl: string,
    warnings: BrowseWarningRecord[],
    onSelectedListing?: (listingHref: string) => void,
  ): Promise<SelectedListing | null> {
    await this.waitForPropertyLinks(page, countyUrl);

    let listingLinks = page
      .locator('a[href*="/dashboard/property/"]')
      .filter({ hasText: /\$\s?\d[\d,]*/ })
      .filter({ visible: true });

    if ((await listingLinks.count()) === 0) {
      listingLinks = page.locator('a[href*="/dashboard/property/"]').filter({ visible: true });
    }

    const listingCount = await listingLinks.count();

    if (listingCount === 0) return null;

    const randomIndex = Math.floor(random() * listingCount);
    const listingLink = listingLinks.nth(randomIndex);
    const listingHref = await listingLink.getAttribute('href');

    if (!listingHref) {
      throw new Error(`Selected listing link did not have an href on ${countyUrl}`);
    }

    const absoluteListingHref = new URL(listingHref, page.url()).href;

    const listingFacts = await this.logListingCardSignals(
      listingLink,
      absoluteListingHref,
      warnings,
    );

    onSelectedListing?.(absoluteListingHref);

    await listingLink.scrollIntoViewIfNeeded();

    await Promise.all([
      page.waitForURL(/\/dashboard\/property\//, { timeout: 15000 }),
      listingLink.click(),
    ]);

    await page.waitForLoadState('domcontentloaded').catch(() => null);

    return { facts: listingFacts, href: absoluteListingHref };
  }

  private async logListingCardSignals(
    listingLink: Locator,
    listingHref: string,
    warnings: BrowseWarningRecord[],
  ): Promise<ListingFacts> {
    const text = await listingLink
      .evaluate((element) => {
        const normalizeLines = (value: string | null | undefined) =>
          (value || '')
            .replace(/\r/g, '')
            .replace(/[ \t]+/g, ' ')
            .replace(/[ \t]*\n[ \t]*/g, '\n')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        const compact = (value: string) => value.replace(/\s+/g, ' ').trim();
        let candidate: Element | null = element;
        let selectedText = normalizeLines((element as HTMLElement).innerText || element.textContent);

        for (let depth = 0; candidate && depth < 4; depth += 1, candidate = candidate.parentElement) {
          const candidateText = normalizeLines(
            (candidate as HTMLElement).innerText || candidate.textContent,
          );

          if (
            compact(candidateText).includes(compact(selectedText)) &&
            compact(candidateText).length > compact(selectedText).length &&
            compact(candidateText).length < 2500
          ) {
            selectedText = candidateText;
          }
        }

        return selectedText;
      })
      .catch(() => '');

    if (!text) {
      this.recordWarning(
        warnings,
        'selected listing card',
        listingHref,
        `[browseAll] Selected listing card has no readable text`,
      );
      return {};
    }

    const compactText = text.replace(/\s+/g, ' ').trim();
    const cardFacts = this.extractListingFacts(text);
    const lines = text
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const addressPattern =
      /\b\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9 .#'/-]+,\s*[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:\s+\d{5})?\b/;
    const factsPattern =
      /\b\d+(?:\.\d+)?\s*(?:beds?|bedrooms?|baths?|bathrooms?)\b|\b[\d,]+\s*sqft\b/i;
    const brokerageKeywordPattern =
      /\b(?:REALTY|REAL ESTATE|BROKER|BROKERAGE|PROPERTY|PROPERTIES|LLC|INC|BANKER|KELLER|WILLIAMS|COMPASS|EXP|RE\/MAX|CENTURY\s*21|BERKSHIRE|HATHAWAY|HOMESERVICES)\b/i;
    const addressLineIndex = lines.findIndex((line) => addressPattern.test(line));
    const factsLineIndex = lines.findIndex((line) => factsPattern.test(line));
    const brokerageLine =
      addressLineIndex >= 0 && factsLineIndex > addressLineIndex
        ? lines
            .slice(addressLineIndex + 1, factsLineIndex)
            .find(
              (line) =>
                !/\$\s?\d[\d,]*/.test(line) &&
                !/cash back|eligible|listing photo|home for sale/i.test(line),
            )
        : undefined;
    const expectedSignals = [
      { label: 'price', present: Boolean(cardFacts.prices?.length) },
      { label: 'address/location', present: Boolean(cardFacts.address) },
      {
        label: 'brokerage',
        present: Boolean(brokerageLine) || brokerageKeywordPattern.test(compactText),
      },
      { label: 'beds', present: Boolean(cardFacts.beds) },
      { label: 'baths', present: Boolean(cardFacts.baths) },
      { label: 'sqft', present: Boolean(cardFacts.sqft) },
    ];

    const missingSignals = expectedSignals
      .filter(({ present }) => !present)
      .map(({ label }) => label);

    if (missingSignals.length > 0) {
      const textPreview = text.length > 400 ? `${text.slice(0, 400)}...` : text;

      this.recordWarning(
        warnings,
        'selected listing card',
        listingHref,
        [
          `[browseAll] Selected listing card is missing: ${missingSignals.join(', ')}`,
          `Listing: ${listingHref}`,
          `Inspected card text: ${textPreview}`,
        ].join(' | '),
      );
    }

    return cardFacts;
  }

  private async waitForPropertyLinks(page: Page, countyUrl: string) {
    await expect
      .poll(async () => await page.locator('a[href*="/dashboard/property/"]').count(), {
        message: `Expected property links to exist on ${countyUrl}`,
        timeout: 20000,
        intervals: [1000, 2000, 3000, 5000],
      })
      .toBeGreaterThan(0);
  }

  private async expectPropertyPageLoaded(
    page: Page,
    listingHref: string,
    selectedCardFacts: ListingFacts = {},
    warnings: BrowseWarningRecord[] = [],
  ) {
    const expectedPath = new URL(listingHref, page.url()).pathname;

    expect(new URL(page.url()).pathname, `Expected listing page to open: ${listingHref}`).toBe(
      expectedPath,
    );

    await expect(
      page
        .getByText(/\$\s?\d[\d,]*/)
        .or(page.getByRole('button', { name: /request a tour/i }))
        .or(page.getByRole('button', { name: /make offer/i }))
        .first(),
      `Expected property details to render for ${listingHref}`,
    ).toBeVisible({ timeout: 30000 });

    await this.warnIfPropertyFactsDifferFromCard(page, listingHref, selectedCardFacts, warnings);
  }

  private async warnIfPropertyFactsDifferFromCard(
    page: Page,
    listingHref: string,
    selectedCardFacts: ListingFacts,
    warnings: BrowseWarningRecord[],
  ) {
    const hasSelectedFacts = Boolean(
      selectedCardFacts.address ||
        selectedCardFacts.beds ||
        selectedCardFacts.baths ||
        selectedCardFacts.prices?.length ||
        selectedCardFacts.sqft,
    );

    if (!hasSelectedFacts) return;

    const propertyText = await page
      .locator('body')
      .innerText({ timeout: 5000 })
      .catch(() => '');
    const propertyFacts = this.extractListingFacts(propertyText);
    const normalizedPropertyText = this.normalizeAddress(propertyText);
    const mismatches: string[] = [];

    if (
      selectedCardFacts.prices?.length &&
      !selectedCardFacts.prices.some((price) => propertyFacts.prices?.includes(price))
    ) {
      mismatches.push(
        `price card=${selectedCardFacts.prices.join('/')} property=${
          propertyFacts.prices?.join('/') || 'missing'
        }`,
      );
    }

    if (
      selectedCardFacts.address &&
      !normalizedPropertyText.includes(selectedCardFacts.address)
    ) {
      mismatches.push(`address card="${selectedCardFacts.address}" property=missing`);
    }

    for (const key of ['beds', 'baths', 'sqft'] as const) {
      if (selectedCardFacts[key] && propertyFacts[key] !== selectedCardFacts[key]) {
        mismatches.push(
          `${key} card=${selectedCardFacts[key]} property=${propertyFacts[key] ?? 'missing'}`,
        );
      }
    }

    if (mismatches.length === 0) return;

    this.recordWarning(
      warnings,
      'property page facts',
      page.url(),
      [
        `[browseAll] Property page facts differ from selected listing card: ${mismatches.join(', ')}`,
        `Listing: ${listingHref}`,
      ].join(' | '),
    );
  }

  private extractListingFacts(text: string): ListingFacts {
    const compactText = text.replace(/\s+/g, ' ').trim();
    const lines = this.getListingFactLines(text);
    const addressPattern =
      /\b\d{1,6}\s+[A-Za-z0-9][A-Za-z0-9 .#'/-]+,\s*[A-Za-z .'-]+,\s*[A-Za-z .'-]+(?:\s+\d{5})?\b/;
    const addressLine = lines.find(
      (line) =>
        addressPattern.test(line) &&
        !/\$|cash back|eligible|listing photo|home for sale/i.test(line),
    );
    const beds = compactText.match(/\b(\d+(?:\.\d+)?)\s*(?:beds?|bedrooms?)/i)?.[1];
    const baths = compactText.match(/\b(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?)/i)?.[1];
    const sqftMatch = compactText.match(/\b([\d,]+)\s*(?:sq\.?\s*ft\.?|sqft)\b/i);

    return {
      address: addressLine ? this.normalizeAddress(addressLine) : undefined,
      beds: this.normalizeListingFactNumber(beds),
      baths: this.normalizeListingFactNumber(baths),
      prices: this.extractListingPrices(lines),
      sqft: this.normalizeListingFactNumber(sqftMatch?.[1]),
    };
  }

  private extractListingPrices(lines: string[]) {
    const prices = lines
      .filter((line) => !/cash back|\/\s*mo\b/i.test(line))
      .flatMap((line) =>
        [...line.matchAll(/\$\s?([\d,]+)(?!\s*\/\s*mo)/g)].map((match) =>
          this.normalizeListingFactNumber(match[1]),
        ),
      )
      .filter((value): value is string => Boolean(value));
    const salePriceCandidates = prices.filter((price) => Number(price) >= 50000);

    return [...new Set(salePriceCandidates.length > 0 ? salePriceCandidates : prices)];
  }

  private getListingFactLines(text: string) {
    return text
      .replace(/\r/g, '')
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
  }

  private normalizeAddress(value: string) {
    return value
      .replace(/\s+/g, ' ')
      .replace(/[.,]/g, '')
      .trim()
      .toLowerCase();
  }

  private normalizeListingFactNumber(value?: string) {
    return value?.replace(/,/g, '');
  }

  private async clickRandomPropertyBreadcrumb(
    page: Page,
    listingHref: string,
    expectedStateName: string,
    onSelectedBreadcrumb?: (breadcrumbHref: string) => void,
  ): Promise<string> {
    const breadcrumb = page.getByRole('navigation', { name: /breadcrumb/i }).first();

    await expect(breadcrumb, `Expected property breadcrumb for ${listingHref}`).toBeVisible({
      timeout: 30000,
    });

    await expect(
      breadcrumb.locator('li').first(),
      `Expected breadcrumb items for ${listingHref}`,
    ).toBeVisible({ timeout: 30000 });

    const breadcrumbItems = await breadcrumb
      .locator('li')
      .evaluateAll((items) =>
        items
          .map((item) => item.textContent?.trim().replace(/\s+/g, ' ') || '')
          .filter((text) => text.length > 0),
      );

    expect(
      breadcrumbItems.length,
      `Expected property breadcrumb hierarchy with at least five visible items for ${listingHref}. Found: ${breadcrumbItems.join(
        ' > ',
      )}`,
    ).toBeGreaterThanOrEqual(5);

    expect(
      breadcrumbItems[0],
      `Expected first breadcrumb item to be Homes for ${listingHref}. Found: ${breadcrumbItems.join(
        ' > ',
      )}`,
    ).toMatch(/^Homes$/i);

    expect(
      breadcrumbItems[1],
      `Expected second breadcrumb item to be ${expectedStateName} for ${listingHref}. Found: ${breadcrumbItems.join(
        ' > ',
      )}`,
    ).toMatch(new RegExp(`^${this.escapeRegex(expectedStateName)}$`, 'i'));

    expect(
      breadcrumbItems.some((item) => /\b\d{5}\b/.test(item)),
      `Expected breadcrumb to include a ZIP crumb for ${listingHref}. Found: ${breadcrumbItems.join(
        ' > ',
      )}`,
    ).toBe(true);

    const breadcrumbLinks = await breadcrumb.locator('a[href]').evaluateAll((links) =>
      links
        .map((link, index) => ({
          href: link.getAttribute('href') || '',
          index,
          text: link.textContent?.trim() || '',
        }))
        .filter(({ href, text }) => href && text),
    );

    const preferredLinks = breadcrumbLinks.filter(
      ({ href, text }) =>
        !new RegExp(`^(Homes|${this.escapeRegex(expectedStateName)})$`, 'i').test(text) &&
        !href.includes('/dashboard/property/'),
    );

    const clickableLinks = preferredLinks.length > 0 ? preferredLinks : breadcrumbLinks;
    const randomLink = clickableLinks[Math.floor(random() * clickableLinks.length)];

    expect(
      randomLink,
      `Expected at least one clickable breadcrumb link for ${listingHref}`,
    ).toBeTruthy();

    const targetUrl = new URL(randomLink!.href, page.url());
    const link = breadcrumb.locator('a[href]').nth(randomLink!.index);

    onSelectedBreadcrumb?.(targetUrl.href);

    await Promise.all([
      page.waitForURL((url) => url.pathname === targetUrl.pathname, { timeout: 15000 }),
      link.click(),
    ]);

    await page.waitForLoadState('domcontentloaded').catch(() => null);

    return targetUrl.href;
  }

  private async getErrorUi(page: Page): Promise<string | null> {
    const pageNotFoundHeading = page
      .getByRole('heading', { name: /^(404|501)\s+Page Not Found!?$/i })
      .first();

    if (await pageNotFoundHeading.isVisible().catch(() => false)) {
      return (
        (await pageNotFoundHeading.textContent())?.trim().replace(/\s+/g, ' ') ||
        '404/501 Page Not Found'
      );
    }

    const offMarketMessage = page.getByText(/Looks like this page has gone off-market/i).first();

    if (await offMarketMessage.isVisible().catch(() => false)) {
      return (
        (await offMarketMessage.textContent())?.trim().replace(/\s+/g, ' ') || 'Off-market page'
      );
    }

    return null;
  }

  private async attachBrowsedUrls(
    testInfo: TestInfo,
    browsedUrls: BrowsedUrlRecord[],
    badUrls: string[] = [],
    warnings: BrowseWarningRecord[] = [],
  ) {
    const content = this.formatBrowsedUrls(browsedUrls, badUrls, warnings);
    const hasErrors =
      badUrls.length > 0 ||
      browsedUrls.some((record) => record.error) ||
      /^Total errors:\s*[1-9]\d*/m.test(content) ||
      /\bERROR URL:|\bFAILED URL:|\bFAILED LISTING:|\bFAILED BREADCRUMB:|\bError:/m.test(content);
    const reportName = hasErrors ? 'failed-browsed-urls' : 'passed-browsed-urls';
    const reportDateTime = this.formatReportDateTime(new Date());

    await fs.mkdir('artifacts', { recursive: true });
    await fs.writeFile(`artifacts/${reportName}-${reportDateTime}.txt`, content, 'utf8');

    await testInfo.attach(`${reportName}.txt`, {
      body: content,
      contentType: 'text/plain',
    });
  }

  private formatBrowsedUrls(
    browsedUrls: BrowsedUrlRecord[],
    badUrls: string[] = [],
    warnings: BrowseWarningRecord[] = [],
  ): string {
    if (browsedUrls.length === 0) return 'No browsed URLs recorded.';

    const errors = browsedUrls.filter((record) => record.error);
    const redirects = browsedUrls.filter((record) => record.redirected);

    const formatRecord = (record: BrowsedUrlRecord, index: number) => {
      const details = [`${index + 1}. ${record.url}`, `Context: ${record.context}`];

      if (record.selectedUrl) {
        details.push(`Selected URL: ${record.selectedUrl}`);
        details.push(`Opened URL: ${record.url}`);
      }

      if (record.redirected) details.push('Redirected: YES');
      if (record.status !== undefined) details.push(`Status: ${record.status}`);
      if (record.error) details.push(`Error: ${record.error}`);

      return details.join(' | ');
    };
    const browsedErrorLines = errors.map((record, index) => formatRecord(record, index));
    const errorLines = [...badUrls, ...browsedErrorLines];

    return [
      `Total browsed URLs: ${browsedUrls.length}`,
      `Total errors: ${errorLines.length}`,
      `Total warnings: ${warnings.length}`,
      `Total redirects: ${redirects.length}`,
      '',
      '=====================================',
      'ERRORS',
      '=====================================',
      '',
      ...(errorLines.length === 0 ? ['No errors recorded.'] : errorLines),
      '',
      '=====================================',
      'WARNINGS',
      '=====================================',
      '',
      ...(warnings.length === 0
        ? ['No warnings recorded.']
        : warnings.map(
            (warning, index) =>
              `${index + 1}. ${warning.url} | Context: ${warning.context} | Warning: ${
                warning.message
              }`,
          )),
      '',
      '=====================================',
      'REDIRECTS',
      '=====================================',
      '',
      ...(redirects.length === 0
        ? ['No redirects recorded.']
        : redirects.map((record, index) => formatRecord(record, index))),
      '',
      '=====================================',
      'ALL BROWSED URLS',
      '=====================================',
      '',
      ...browsedUrls.map((record, index) => formatRecord(record, index)),
    ].join('\n');
  }

  private recordBrowsedUrl(
    browsedUrls: BrowsedUrlRecord[],
    context: string,
    url: string,
    details: Omit<BrowsedUrlRecord, 'context' | 'url'> = {},
  ) {
    browsedUrls.push({ context, url, ...details });
  }

  private recordFailedUrl(badUrls: string[], failedUrl: string) {
    console.error(failedUrl);
    badUrls.push(failedUrl);
  }

  private recordWarning(
    warnings: BrowseWarningRecord[],
    context: string,
    url: string,
    message: string,
  ) {
    console.warn(message);
    warnings.push({ context, message, url });
  }

  private reportBrokenUrls(badUrls: string[]) {
    if (badUrls.length === 0) return;

    console.warn(`Broken URLs recorded in artifact:\n\n${badUrls.join('\n')}`);
  }

  private formatReportDateTime(date: Date) {
    const pad = (value: number) => value.toString().padStart(2, '0');

    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      '_',
      pad(date.getHours()),
      '-',
      pad(date.getMinutes()),
      '-',
      pad(date.getSeconds()),
    ].join('');
  }

  private getBrowseStateCode(startPath: string): string {
    const pathname = new URL(startPath, 'https://example.com').pathname;
    const match = pathname.match(/^\/homes\/([a-z]{2})(?:\/)?$/i);

    if (!match) {
      throw new Error(`Expected browse listings path like /homes/fl, but received: ${startPath}`);
    }

    return match[1].toLowerCase();
  }

  private getStateName(stateCode: string): string {
    const stateName = stateNamesByCode[stateCode.toLowerCase()];

    if (!stateName) {
      throw new Error(`Unsupported state code for browse listings test: ${stateCode}`);
    }

    return stateName;
  }

  private normalizeUrl(url: string): string {
    const parsed = new URL(url);
    parsed.hash = '';
    parsed.pathname = parsed.pathname.replace(/\/$/, '');
    return parsed.toString();
  }

  private formatErrorDetails(status?: number, errorUi?: string | null): string | null {
    const details: string[] = [];

    if (status !== undefined && status >= 400) details.push(`HTTP ${status}`);

    if (errorUi) {
      const uiStatus = errorUi.match(/\b(404|501)\b/)?.[1];
      details.push(uiStatus ? `UI ${uiStatus}: ${errorUi}` : `UI: ${errorUi}`);
    }

    return details.length > 0 ? details.join(' | ') : null;
  }

  private formatUnknownError(error: unknown): string {
    return (error instanceof Error ? error.message : String(error)).replace(
      /\u001b\[[0-9;]*m/g,
      '',
    );
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

  private escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
