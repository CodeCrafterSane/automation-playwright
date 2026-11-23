import { random } from '../../utils/random';
import { contracts } from '../../config/contracts';
import { expect, Page } from '@playwright/test';
import { locations, LocationData } from '../../common/testData/locations';

type MortgagePreApprovalOption = 'Yes' | "No, I'm paying cash" | "No, I'd like to get pre-approved";

type PropertyTypeOption = 'Any' | 'Single-family home' | 'Condominium' | 'Townhouse';

type BedsBathsOption = 'Any' | '1+' | '2+' | '3+' | '4+' | '5+';

type BuyerProfileFilterExpectation = {
  location: LocationData;
  homePrice: string;
  propertyType: string;
  bedrooms: string;
  bathrooms: string;
};

const BUYER_PROFILE_API_PATH = contracts.buyerProfile;
const PREFERENCES_SAVE_TIMEOUT = 50000;

const propertySubTypeByOption: Record<string, string | null> = {
  Any: null,
  'Single-family home': 'Single Family Residence',
  Condominium: 'Condominium',
  Townhouse: 'Townhouse',
};

const mortgagePreApprovalOptions: MortgagePreApprovalOption[] = [
  'Yes',
  "No, I'm paying cash",
  "No, I'd like to get pre-approved",
];

const propertyTypeOptions: PropertyTypeOption[] = [
  'Any',
  'Single-family home',
  'Condominium',
  'Townhouse',
];

const bedsBathsOptions: BedsBathsOption[] = ['Any', '1+', '2+', '3+', '4+', '5+'];

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}

function getRandomItems<T>(items: T[], count: number): T[] {
  return [...items].sort(() => random() - 0.5).slice(0, count);
}

function getRandomHomePrice(min = 200000, max = 10000000): string {
  const price = Math.floor(random() * (max - min + 1)) + min;

  return price.toString();
}

function parseMinimumCount(option: string) {
  return option === 'Any' ? null : Number(option.replace('+', ''));
}

function getExpectedStateAbbr(shortName: string) {
  return shortName === 'Washington D.C.' ? 'DC' : shortName.split(', ')[1];
}

function getExpectedProfileSearch(shortName: string) {
  return shortName === 'Washington D.C.' ? 'Washington, DC' : shortName;
}

function getExpectedProfileState(state: string) {
  return state === 'D.C.' ? 'District of Columbia' : state;
}

export default class OnboardingPage {
  constructor(private page: Page) {}

  async gotoLoggedIn() {
    await this.page.goto('/onboarding');
    await this.dismissPrivacyChoices();
    await this.skipPhoneVerificationIfVisible();
  }

  async dismissPrivacyChoices() {
    const rejectOptionalCookies = this.page.getByRole('button', {
      name: 'Reject optional cookies',
    });

    await rejectOptionalCookies.click({ timeout: 3000 }).catch(() => {});
  }

  async skipPhoneVerificationIfVisible() {
    const phoneHeading = this.page.getByRole('heading', {
      name: /phone number|verify your phone|phone verification/i,
    });
    const skipButton = this.page.getByRole('button', {
      name: /skip phone verification|skip/i,
    });

    if (!(await phoneHeading.isVisible({ timeout: 5000 }).catch(() => false))) {
      if (!(await skipButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        return false;
      }
    }

    await skipButton.first().click();
    await this.page
      .waitForURL((url) => !url.pathname.includes('/personal/phone-number'), {
        timeout: 20000,
        waitUntil: 'domcontentloaded',
      })
      .catch(() => undefined);

    return true;
  }

  marketSearchInput() {
    return this.page.getByPlaceholder(
      /Enter (the city, county or zip|a city, neighborhood, or zip code)/,
    );
  }

  homePriceInput() {
    return this.page.getByPlaceholder('Enter home price');
  }

  continueButton() {
    return this.page.getByRole('button', { name: 'Continue' });
  }

  backButton() {
    return this.page.getByRole('button', { name: 'Back' });
  }

  async clickContinue() {
    await this.continueButton().click();
  }
  async clickBack() {
    await this.backButton().click();
  }

  getRandomLocationsToValidate(count: number): LocationData[] {
    const realtyAvailableLocations = locations.filter(
      (location) => location.availability === 'REALTY_AVAILABLE',
    );

    const mortgageOnlyLocations = locations.filter(
      (location) => location.availability === 'MORTGAGE_ONLY',
    );

    const unavailableLocations = locations.filter(
      (location) => location.availability === 'UNAVAILABLE',
    );

    return [
      ...getRandomItems(realtyAvailableLocations, Math.ceil(count / 3)),
      ...getRandomItems(mortgageOnlyLocations, Math.floor(count / 3)),
      ...getRandomItems(unavailableLocations, Math.floor(count / 3)),
    ].slice(0, count);
  }

  getRandomRealtyAvailableLocation(): LocationData {
    const realtyAvailableLocations = locations.filter(
      (location) => location.availability === 'REALTY_AVAILABLE',
    );

    return getRandomItem(realtyAvailableLocations);
  }

  async validateLocationAvailability(location: LocationData) {
    await this.clearMarketSearch();
    await this.fillMarketSearch(location.search);
    await this.expectLocationSuggestionVisible(location.suggestion);

    await this.selectLocationSuggestion(location.suggestion, location.shortName);

    switch (location.availability) {
      case 'REALTY_AVAILABLE':
        await this.expectCashBackEligibilityMessage(location.state);
        break;

      case 'MORTGAGE_ONLY':
        await this.expectRealtyUnavailableMortgageAvailableMessage();
        break;

      case 'UNAVAILABLE':
        await this.expectServicesUnavailableMessage();
        break;
    }
  }

  async expectLoggedInLocationStepVisible() {
    await expect(
      this.page.getByRole('heading', { name: 'Where are you planning to buy?' }),
    ).toBeVisible();

    await expect(this.page.getByRole('link', { name: 'these states' })).toHaveAttribute(
      'href',
      '/availability',
    );

    await expect(this.marketSearchInput()).toBeVisible();
    await expect(this.continueButton()).toBeVisible();
  }

  async clearMarketSearch() {
    const searchInput = this.marketSearchInput();

    await searchInput.click();
    await searchInput.fill('');
    await searchInput.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await searchInput.press('Backspace');
    await expect(searchInput).toHaveValue('');
  }

  async fillMarketSearch(searchText: string) {
    const searchInput = this.marketSearchInput();

    await this.dismissPrivacyChoices();
    await searchInput.click();
    await searchInput.fill('');
    await searchInput.pressSequentially(searchText);
    await expect(searchInput).toHaveValue(searchText);

    return searchInput;
  }

  async continueWithoutValidLocation() {
    await this.clickContinue();
  }

  async expectValidLocationRequiredMessage() {
    await expect(
      this.page.getByText('Please enter or select a valid city, neighborhood, or zip code.'),
    ).toBeVisible();
  }

  async expectLocationSuggestionVisible(suggestionName: RegExp) {
    await expect(this.page.getByText(suggestionName).first()).toBeVisible();
  }

  async selectLocationSuggestion(suggestionName: RegExp, selectedInputValue: string) {
    await this.page.getByText(suggestionName).first().click();

    const actual = await this.marketSearchInput().inputValue();

    const normalize = (value: string) =>
      value
        .toLowerCase()
        .replace(/[.,]/g, '') // Remove punctuation
        .replace(/\b[a-z]{2}\b/g, '') // Remove state abbreviations (MD, DC, CA, etc.)
        .replace(/\s+/g, ' ')
        .trim();

    expect(normalize(actual)).toContain(normalize(selectedInputValue));
  }

  async expectCashBackEligibilityMessage(stateName: string) {
    await expect(this.page.getByText('Good news!')).toBeVisible();
    const statePattern =
      stateName.toLowerCase() === 'd.c.' || stateName.toLowerCase() === 'washington d.c.'
        ? '(?:Washington\\s+D\\.C\\.|D\\.C\\.)'
        : this.escapeRegExp(stateName);

    await expect(
      this.page.getByText(
        new RegExp(`Homebuyers in\\s+${statePattern}\\s+may be eligible for cash back`, 'i'),
      ),
    ).toBeVisible();
  }

  async expectRealtyUnavailableMortgageAvailableMessage() {
    await expect(
      this.page.getByText("Realty services aren't available in your state yet"),
    ).toBeVisible();

    await expect(this.page.getByText('Realty', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Mortgage', { exact: true })).toBeVisible();

    await expect(this.page.getByText(/You can continue with mortgage services now/i)).toBeVisible();

    await expect(
      this.page.getByText(/we’ll notify you once realty services launch in your state/i),
    ).toBeVisible();
  }

  async expectServicesUnavailableMessage() {
    await expect(
      this.page.getByText("Our services aren't available in your state yet"),
    ).toBeVisible();

    await expect(this.page.getByText('Realty', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Mortgage', { exact: true })).toBeVisible();

    await expect(
      this.page.getByText(/We’re not in your area just yet, but we’re expanding fast/i),
    ).toBeVisible();

    await expect(
      this.page.getByText(/We’ll notify you as soon as the platform becomes available in your state/i),
    ).toBeVisible();
  }

  async continueToBudgetStep() {
    await this.clickContinue();
    await this.expectBudgetStepVisible();
  }

  async expectBudgetStepVisible() {
    await expect(
      this.page.getByRole('heading', { name: "What's your estimated budget?" }),
    ).toBeVisible();

    await expect(this.page.getByText('Estimate savings', { exact: true })).toBeVisible();
    await expect(this.page.getByText('Homebuying plan', { exact: true })).toBeVisible();
    await expect(this.homePriceInput()).toBeVisible();
  }

  async continueWithoutBudget() {
    await this.clickContinue();
  }

  async expectBudgetRequiredMessage() {
    await expect(this.page.getByText('Please enter a home price')).toBeVisible();
  }

  async enterEstimatedBudget(homePrice: string) {
    const input = this.homePriceInput();

    await input.click();
    await input.fill('');
    await input.fill(homePrice);

    await expect(input).toHaveValue(this.formatHomePriceInput(homePrice));
  }

  async enterRandomEstimatedBudget() {
    const homePrice = getRandomHomePrice();

    await this.enterEstimatedBudget(homePrice);

    return homePrice;
  }

  async continueToCashBackEstimate() {
    await this.clickContinue();
  }

  async getEstimatedCashback() {
    const cashback = await this.getVisibleEstimatedCashbackText();

    expect(cashback).not.toBe('');
    expect(cashback).not.toBe('$0');

    return cashback;
  }

  async expectNoEstimatedCashback() {
    await expect.poll(async () => this.getVisibleEstimatedCashbackText()).toBe('');
    await expect(this.estimatedCashbackHeading()).toBeHidden();
    await expect(this.estimatedCashbackAmount()).toHaveCount(0);
  }

  async continueFromCashBackEstimate() {
    await this.clickContinue();
  }

  async isMortgagePreApprovalStepVisible() {
    return this.page
      .getByRole('heading', { name: 'Are you already pre-approved' })
      .isVisible({ timeout: 3000 })
      .catch(() => false);
  }

  async returnFromMortgageToBudgetStep() {
    await this.clickBack();
    await this.expectBudgetStepVisible();
  }

  async returnFromPropertyTypeToBudgetStep() {
    await this.clickBack();
    await this.expectBudgetStepVisible();
  }

  async expectEstimatedCashbackNotToEqual(previousCashback: string) {
    const cashback = await this.getVisibleEstimatedCashbackText();

    if (cashback === '' || cashback === '$0') {
      return '';
    }

    expect(cashback).not.toBe(previousCashback);

    return cashback;
  }

  async selectRandomMortgagePreApproval() {
    const option = getRandomItem(mortgagePreApprovalOptions);

    await this.page.getByText(option, { exact: true }).click();

    return option;
  }

  async continueToPropertyTypeStep() {
    await this.clickContinue();
    await this.expectPropertyTypeStepVisible();
  }

  async expectPropertyTypeStepVisible() {
    await expect(
      this.page.getByRole('heading', { name: /Finalize your homebuying plan/i }),
    ).toBeVisible();
  }

  async selectRandomPropertyType() {
    const option = getRandomItem(propertyTypeOptions);

    await this.page.getByText(option, { exact: true }).click();

    return option;
  }

  async continueToBedsAndBathsStep() {
    await this.clickContinue();
  }

  async selectRandomBedroomsAndBathrooms() {
    const bedrooms = getRandomItem(bedsBathsOptions);
    const bathrooms = getRandomItem(bedsBathsOptions);

    await this.page.getByText(bedrooms, { exact: true }).first().click();
    await this.page.getByText(bathrooms, { exact: true }).last().click();

    return { bedrooms, bathrooms };
  }

  async expectSubmitStepVisible() {
    await expect(this.page.getByRole('button', { name: /submit/i })).toBeVisible();
  }

  async clickSubmitButton() {
    await this.page.getByRole('button', { name: /submit/i }).click();
  }

  async expectOnboardingComplete() {
    await expect(this.page.getByText('Your homebuying plan is ready')).toBeVisible({
      timeout: PREFERENCES_SAVE_TIMEOUT,
    });
  }

  async submitOnboardingAndExpectDashboard(location: LocationData) {
    await this.expectSubmitStepVisible();
    await this.clickSubmitButton();
    await this.skipPhoneVerificationIfVisible();

    if (location.availability === 'REALTY_AVAILABLE') {
      await this.expectOnboardingComplete();
      await this.clickContinue();
      await this.skipPhoneVerificationIfVisible();
    }

    await this.expectDashboardUrl();
  }

  async expectEstimatedRebate(expectedCashback: string) {
    await expect(this.page.getByText(expectedCashback)).toBeVisible();
  }

  async waitForBuyerProfileResponse() {
    let persistedBuyerProfile: unknown = null;

    await expect
      .poll(
        async () => {
          const response = await this.page.waitForResponse(
            (apiResponse) =>
              apiResponse.request().method() === 'GET' &&
              new URL(apiResponse.url()).pathname === BUYER_PROFILE_API_PATH,
            { timeout: 45000 },
          );

          expect(response.status()).toBe(200);

          const buyerProfile = await response.json();

          if (this.hasPersistedBuyerProfileFilters(buyerProfile)) {
            persistedBuyerProfile = buyerProfile;

            return true;
          }

          return false;
        },
        {
          message: 'buyer profile response should include persisted onboarding filters',
          timeout: PREFERENCES_SAVE_TIMEOUT,
        },
      )
      .toBe(true);

    return persistedBuyerProfile;
  }

  async expectPersistedBuyerProfileFilters(
    buyerProfile: unknown,
    { location, homePrice, propertyType, bedrooms, bathrooms }: BuyerProfileFilterExpectation,
  ) {
    const expectedHomePrice = Number(homePrice);
    const expectedStateAbbr = getExpectedStateAbbr(location.shortName);
    const expectedSearch = getExpectedProfileSearch(location.shortName);
    const expectedState = getExpectedProfileState(location.state);
    const expectedBeds = parseMinimumCount(bedrooms);
    const expectedBaths = parseMinimumCount(bathrooms);
    const expectedPropertySubType = propertySubTypeByOption[propertyType];

    // Neutral example response contract; adapt this shape to the authorized target.
    expect(buyerProfile).toMatchObject({
      preferences: {
        location: { label: expectedSearch, state: expectedState, stateCode: expectedStateAbbr },
        budget: expectedHomePrice,
        beds: expectedBeds,
        baths: expectedBaths,
        propertyType: expectedPropertySubType,
      },
      onboardingComplete: true,
    });

    return buyerProfile;
  }

  private formatHomePriceInput(homePrice: string) {
    return Number(homePrice).toLocaleString('en-US');
  }

  private estimatedCashbackHeading() {
    return this.page.getByRole('heading', { name: 'Your estimated cash back' });
  }

  private estimatedCashbackAmount() {
    return this.estimatedCashbackHeading()
      .locator('..')
      .getByText(/\$[\d,]+/);
  }

  private async expectDashboardUrl() {
    await this.page.waitForURL(/\/dashboard(?:[/?#]|$)/, { timeout: PREFERENCES_SAVE_TIMEOUT });
  }

  private hasPersistedBuyerProfileFilters(value: unknown) {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const preferences = (value as { preferences?: unknown }).preferences;
    if (!preferences || typeof preferences !== 'object') return false;
    const fields = preferences as Record<string, unknown>;
    return typeof fields.budget === 'number' && !!fields.location;
  }

  private async getVisibleEstimatedCashbackText() {
    return this.page.locator('body').evaluate(() => {
      const isVisible = (element: Element) => {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          Number(style.opacity) !== 0 &&
          rect.width > 0 &&
          rect.height > 0
        );
      };

      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const cashbackPattern = /^(?!\$0$)\$[\d,]+$/;
      let node = walker.nextNode();

      while (node) {
        const text = node.textContent?.trim() ?? '';
        const parent = node.parentElement;

        if (parent && cashbackPattern.test(text) && isVisible(parent)) {
          return text;
        }

        node = walker.nextNode();
      }

      return '';
    });
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
