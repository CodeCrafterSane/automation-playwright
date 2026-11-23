import { random } from '../../utils/random';
import { contracts } from '../../config/contracts';
import { expect, Locator, Page } from '@playwright/test';
import LoginPage from '../auth/LoginPage';
import type { PropertyIdentifier, TourSearchStateCode } from '../search/SearchPage';
import { PREFIX } from '../../utils/env';
import type { Role } from '../../config/roles';

export type ActiveTourState = {
  code?: Extract<TourSearchStateCode, 'FL' | 'GA'>;
  label: string;
  rawProfileText: string;
};

export type BuyerAgreementOutcome = 'agreement-required-exited' | 'agreement-not-shown';
export type DashboardTourCandidate = {
  propertyCard: Locator;
  requestTourButton: Locator;
};

const DATE_TEXT_PATTERN =
  /\b(?:today|tomorrow|mon|tue|wed|thu|fri|sat|sun|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2})\b/i;
const TIME_TEXT_PATTERN = /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i;

export default class RequestTourPage {
  constructor(private page: Page) {}

  async expectDashboardReady() {
    await expect(this.page, 'Expected authenticated user to be on the dashboard.').toHaveURL(
      /dashboard/,
    );
    await expect(
      this.page,
      'Expected authenticated dashboard shell, not a logged-out auth page.',
    ).not.toHaveURL(/\/(?:login|register)(?:\/|\?|$)/);
    await this.expectAuthenticatedProfileMenu();
  }

  async readActiveStateFromProfile(): Promise<ActiveTourState> {
    const menu = await this.openProfileMenu();
    let rawProfileText = '';
    let code: Extract<TourSearchStateCode, 'FL' | 'GA'> | undefined;

    for (let attempt = 0; attempt < 20; attempt += 1) {
      rawProfileText = await menu.innerText({ timeout: 15000 });
      code = this.parseActiveTourStateCode(rawProfileText);

      if (code) {
        break;
      }

      await this.page.waitForTimeout(500);
    }

    await this.closeProfileMenu();

    if (code) {
      return {
        code,
        label: code === 'FL' ? 'Florida' : 'Georgia',
        rawProfileText,
      };
    }

    return {
      label: 'Unknown or unsupported',
      rawProfileText,
    };
  }

  isTourSupportedActiveState(
    activeState: ActiveTourState,
  ): activeState is ActiveTourState & { code: Extract<TourSearchStateCode, 'FL' | 'GA'> } {
    return activeState.code === 'FL' || activeState.code === 'GA';
  }

  async ensureLoggedIn(role: Role = 'BUYER') {
    this.ensurePageOpen();

    if (await this.isLoggedIn()) {
      return false;
    }

    const returnUrl = this.currentDashboardUrl();
    const hasPlaceholderSession = await this.hasPlaceholderProfile();

    if (!hasPlaceholderSession && (await this.restoreDashboardSession(returnUrl))) {
      return true;
    }

    if (
      !hasPlaceholderSession &&
      (await this.dashboardEntry()
        .isVisible({ timeout: 5000 })
        .catch(() => false))
    ) {
      if (await this.restoreDashboardSession(returnUrl)) {
        return true;
      }

      throw new Error('Expected Go to dashboard to restore the authenticated dashboard shell.');
    }

    await this.loginDirectly(role);

    if (returnUrl) {
      await this.page.goto(returnUrl);
      await expect(this.page).toHaveURL(/dashboard/);
      await this.expectDashboardShell();
    }

    return true;
  }

  async ensureLoggedInDashboard(role: Role = 'BUYER') {
    this.ensurePageOpen();

    if (!this.isDashboardPage()) {
      await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      await this.page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => undefined);
    }

    if (!(await this.isLoggedIn())) {
      await this.loginDirectly(role);

      if (!this.isDashboardPage()) {
        await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
      }
    }

    await this.expectDashboardReady();
  }

  async expectTimeSlotModalVisible() {
    const dialog = this.tourTimeDialog();

    await expect(dialog, 'Expected tour time slot modal to open.').toBeVisible({ timeout: 30000 });
    await expect(
      dialog
        .getByRole('button', { name: /continue/i })
        .or(this.timeSlotButtons(dialog))
        .first(),
      'Expected tour modal to show a Continue action or selectable time slots.',
    ).toBeVisible({ timeout: 30000 });
  }

  async validateSingleDateAndTimeSelection() {
    const dialog = this.tourTimeDialog();

    await this.tryClickTwoOptions(this.dateButtons(dialog));
    await this.tryClickTwoOptions(this.timeSlotButtons(dialog));

    await expect
      .poll(async () => await this.selectedOptionCount(dialog, DATE_TEXT_PATTERN), {
        message: 'Expected at most one date to remain selected.',
      })
      .toBeLessThanOrEqual(1);
    await expect
      .poll(async () => await this.selectedOptionCount(dialog, TIME_TEXT_PATTERN), {
        message: 'Expected at most one time slot to remain selected.',
      })
      .toBeLessThanOrEqual(1);
  }

  async validateUnavailableTimeSlotsStayDisabled() {
    const dialog = this.tourTimeDialog();
    const disabledSlot = this.disabledTimeSlotButtons(dialog).first();

    if (!(await disabledSlot.isVisible().catch(() => false))) {
      return false;
    }

    await expect
      .poll(async () => await this.isDisabledLike(disabledSlot), {
        message: 'Expected unavailable or occupied tour time slot to stay disabled.',
      })
      .toBe(true);

    return true;
  }

  async validateCanChangeDateAndTimeBeforeContinue() {
    const dialog = this.tourTimeDialog();

    await this.tryClickTwoOptions(this.dateButtons(dialog));
    await this.tryClickTwoOptions(this.timeSlotButtons(dialog));

    return this.selectEligibleDateAndTime();
  }

  async selectEligibleDateAndTime() {
    const dialog = this.tourTimeDialog();
    const date = await this.clickFirstEnabledOption(this.dateButtons(dialog), false);
    const time = await this.clickFirstEnabledOption(this.timeSlotButtons(dialog), true);

    return { date, time };
  }

  async continueFromTimeSlotModal(
    options: { acceptSuccessfulUiTransitionWithoutResponse?: boolean } = {},
  ) {
    const dialog = this.tourTimeDialog();
    const continueButton = dialog.getByRole('button', { name: /continue/i }).first();

    await expect(continueButton, 'Expected Continue button in tour time slot modal.').toBeVisible();
    await expect(continueButton).toBeEnabled();

    const tourBookingPost = this.page
      .waitForResponse(
        (response) => {
          const pathname = new URL(response.url()).pathname;
          return (
            pathname.replace(/\/$/, '') === contracts.tourBooking.replace(/\/$/, '') &&
            response.request().method().toUpperCase() === 'POST'
          );
        },
        { timeout: 90000 },
      )
      .then((response) => ({ kind: 'response' as const, response }))
      .catch((error: unknown) => ({ kind: 'response-timeout' as const, error }));

    await continueButton.click();

    if (options.acceptSuccessfulUiTransitionWithoutResponse) {
      const postTimeSlotState = this.waitForPostTimeSlotState(90000)
        .then(() => ({ kind: 'ui-transition' as const }))
        .catch((error: unknown) => ({ kind: 'ui-timeout' as const, error }));
      const firstOutcome = await Promise.race([tourBookingPost, postTimeSlotState]);

      if (firstOutcome.kind === 'ui-transition') {
        const promptlyObservedResponse = await Promise.race([
          tourBookingPost,
          this.page.waitForTimeout(2_000).then(() => undefined),
        ]);

        if (
          promptlyObservedResponse?.kind === 'response' &&
          !promptlyObservedResponse.response.ok()
        ) {
          throw new Error(
            `Configured tour-booking request failed with status ${promptlyObservedResponse.response.status()} for ${promptlyObservedResponse.response.url()}.`,
          );
        }

        return;
      }

      if (firstOutcome.kind === 'response') {
        this.expectSuccessfulTourBookingResponse(firstOutcome.response);
        const uiOutcome = await postTimeSlotState;
        if (uiOutcome.kind === 'ui-transition') {
          return;
        }
      } else {
        const uiOutcome = await postTimeSlotState;
        if (uiOutcome.kind === 'ui-transition') {
          return;
        }
      }

      throw new Error(
        'Tour booking neither returned a matching response nor advanced to phone details, Buyer Agreement, or confirmation within 90s.',
      );
    }

    const responseOutcome = await tourBookingPost;
    if (responseOutcome.kind !== 'response') {
      throw new Error(
        'Configured tour-booking request was not observed within 90s after Continue on the time-slot form.',
      );
    }

    this.expectSuccessfulTourBookingResponse(responseOutcome.response);
    await this.waitForPostTimeSlotState();
  }

  private expectSuccessfulTourBookingResponse(response: {
    ok(): boolean;
    status(): number;
    url(): string;
  }) {
    if (!response.ok()) {
      throw new Error(
        `Configured tour-booking request failed with status ${response.status()} for ${response.url()}.`,
      );
    }
  }

  async cancelTimeSlotModal() {
    const dialog = this.tourTimeDialog();
    const cancelButton = dialog
      .getByRole('button', { name: /^cancel$/i })
      .or(dialog.getByRole('button', { name: /close/i }))
      .first();

    await expect(
      cancelButton,
      'Expected Cancel or Close action in tour time slot modal.',
    ).toBeVisible();
    await cancelButton.click();
    await expect(dialog, 'Expected tour time slot modal to close after cancel.').toBeHidden({
      timeout: 20000,
    });
  }

  async handlePhoneNumberIfRequested() {
    const phoneDialog = this.phoneNumberDialog();

    if (!(await phoneDialog.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    const phoneInput = this.phoneInput(phoneDialog);
    const continueButton = phoneDialog
      .getByRole('button', { name: /continue|save|submit/i })
      .first();

    await expect(phoneInput, 'Expected phone number input in contact details modal.').toBeVisible();
    await expect(continueButton).toBeVisible();
    await continueButton.click();
    await expect(
      phoneDialog
        .locator('[role="alert"], [data-slot="form-message"]')
        .or(phoneDialog.getByText(/required|valid phone|phone number/i))
        .first(),
      'Expected required phone/contact validation after continuing without phone number.',
    ).toBeVisible({ timeout: 5000 });

    await this.selectNepalCountryCode(phoneDialog);
    await phoneInput.fill(this.randomNepalPhoneNumber());
    await expect(phoneInput).toHaveValue(/\d{10}/);
    await continueButton.click();
    await expect(
      phoneDialog,
      'Expected phone number modal to close after valid phone entry.',
    ).toBeHidden({
      timeout: 30000,
    });

    return true;
  }

  async validateBuyerAgreementAndExit(): Promise<BuyerAgreementOutcome> {
    const buyerAgreementDialog = this.buyerAgreementDialog();

    if (!(await buyerAgreementDialog.isVisible({ timeout: 15000 }).catch(() => false))) {
      return 'agreement-not-shown';
    }

    await this.validateCobuyerFields(buyerAgreementDialog);
    await this.exitBuyerAgreement(buyerAgreementDialog);

    return 'agreement-required-exited';
  }

  async closeTourConfirmationIfVisible() {
    const confirmationDialog = this.dialogWithText(
      /tour.*(confirmed|requested|scheduled)|confirmed|scheduled/i,
    );

    if (!(await confirmationDialog.isVisible({ timeout: 5000 }).catch(() => false))) {
      return false;
    }

    const closeButton = confirmationDialog
      .getByRole('button', { name: /done|close|got it|ok/i })
      .first();

    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    }

    await expect(confirmationDialog).toBeHidden({ timeout: 20000 });
    return true;
  }

  private async waitForPostTimeSlotState(timeout = 30000) {
    const timeSlotDialog = this.tourTimeDialog();
    const phoneDialog = this.phoneNumberDialog();
    const buyerAgreementDialog = this.buyerAgreementDialog();
    const confirmationDialog = this.dialogWithText(
      /tour.*(confirmed|requested|scheduled)|confirmed|scheduled/i,
    );

    await expect
      .poll(
        async () => {
          if (!(await this.hasTimeSlotControls(timeSlotDialog))) {
            return 'time-slot-closed';
          }

          if (await phoneDialog.isVisible().catch(() => false)) {
            return 'phone';
          }

          if (await buyerAgreementDialog.isVisible().catch(() => false)) {
            return 'buyer-agreement';
          }

          if (await confirmationDialog.isVisible().catch(() => false)) {
            return 'confirmation';
          }

          return null;
        },
        {
          timeout,
          message:
            'Expected the time slot modal to advance to a post-tour state: phone details, buyer agreement, confirmation, or a dialog without time slot controls.',
        },
      )
      .not.toBeNull();
  }

  async goToDashboard() {
    const homeLink = this.page
      .getByRole('link', { name: /^(hub|dashboard|homebuying hub)$/i })
      .or(this.page.getByRole('button', { name: /^(hub|dashboard|homebuying hub)$/i }))
      .first();

    if (await homeLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await homeLink.click();
    } else {
      await this.page.goto('/dashboard');
    }

    await this.page.waitForURL((url) => /^\/dashboard\/?$/.test(url.pathname), { timeout: 15000 });
    await this.expectDashboardReady();
  }

  async assertRequestedTourVisibleInUpcomingTours(propertyIdentifier: PropertyIdentifier) {
    await this.goToDashboard();
    await this.openToursPageFromDashboardTourSection();
    await this.pollUntilRequestedTourVisibleOnToursPage(propertyIdentifier);
    await this.goToDashboard();
  }

  async assertRequestedTourVisibleFromHubTours(propertyIdentifier: PropertyIdentifier) {
    await this.goToDashboardForTourVerification();
    await this.expectUpcomingToursSection();
    await this.openToursPageFromSideNav();
    await this.pollUntilRequestedTourVisibleOnToursPage(propertyIdentifier);
    await this.goToDashboardForTourVerification();
  }

  private async pollUntilRequestedTourVisibleOnToursPage(propertyIdentifier: PropertyIdentifier) {
    const propertyLead = propertyIdentifier.titleOrAddress.split(',')[0]!.trim();
    const deadline = Date.now() + 90_000;

    while (Date.now() < deadline) {
      const tourMatch = this.requestedTourCardOnToursPage(propertyIdentifier, propertyLead);

      if (await tourMatch.isVisible().catch(() => false)) {
        await expect(
          tourMatch,
          `Expected requested property "${propertyLead}" to appear in the Tours list.`,
        ).toBeVisible();
        return;
      }

      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0) {
        break;
      }

      await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await this.page
        .waitForURL((url) => url.pathname === '/dashboard/tours', {
          timeout: Math.min(15000, remainingMs),
        })
        .catch(() => undefined);

      const upcomingTab = this.page.getByRole('tab', { name: /^upcoming$/i });
      if (await upcomingTab.isVisible().catch(() => false)) {
        await upcomingTab.click().catch(() => undefined);
      }

      await this.page.waitForTimeout(Math.min(3000, Math.max(0, deadline - Date.now())));
    }

    throw new Error(
      `Expected requested property "${propertyLead}" (id: ${propertyIdentifier.propertyId ?? 'n/a'}) to appear in the Tours list within 90s.`,
    );
  }

  private requestedTourCardOnToursPage(
    propertyIdentifier: PropertyIdentifier,
    propertyLead: string,
  ) {
    const list = this.upcomingToursListContent();

    if (propertyIdentifier.propertyId) {
      return list
        .locator(`[data-slot="card"]`)
        .filter({
          has: this.page.locator(`a[href*="${propertyIdentifier.propertyId}"]`),
        })
        .or(list.locator(`[data-slot="card"]`).filter({ hasText: propertyLead }))
        .first();
    }

    return list.locator(`[data-slot="card"]`).filter({ hasText: propertyLead }).first();
  }

  private upcomingToursListContent() {
    return this.page
      .getByRole('tabpanel')
      .first()
      .or(
        this.page
          .locator('div.w-full')
          .filter({ has: this.page.getByRole('heading', { name: /^tours$/i }) })
          .first(),
      );
  }

  async findDashboardTourCandidate(
    maxHorizontalAttempts = 3,
  ): Promise<DashboardTourCandidate | undefined> {
    await this.goToDashboardForTourVerification();
    await this.scrollToNewListingsForYou();
    await this.waitForDashboardListingCards();

    const section = this.newListingsForYouSection();

    if (!(await section.isVisible({ timeout: 5000 }).catch(() => false))) {
      return undefined;
    }

    await this.closeAssistantChatIfVisible();
    await this.scrollDashboardListingSectionIntoView(section);

    for (let attempt = 0; attempt <= maxHorizontalAttempts; attempt += 1) {
      const requestTourButtons = this.requestTourButtonsInSection(section);
      const buttonIndex = await this.randomClickableButtonIndex(requestTourButtons);

      if (buttonIndex !== undefined) {
        const requestTourButton = requestTourButtons.nth(buttonIndex);

        return {
          requestTourButton,
          propertyCard: this.propertyCardFromRequestTourButton(requestTourButton),
        };
      }

      if (!(await this.advanceDashboardPropertyCarousel(section))) {
        break;
      }
    }

    return undefined;
  }

  async findDashboardPropertyCardWithEnabledTourCta(maxHorizontalAttempts = 3) {
    return (await this.findDashboardTourCandidate(maxHorizontalAttempts))?.propertyCard;
  }

  async getDashboardPropertyIdentifier(propertyCard: Locator): Promise<PropertyIdentifier> {
    return {
      propertyId: await this.getDashboardPropertyId(propertyCard),
      titleOrAddress: await this.getDashboardPropertyTitleOrAddress(propertyCard),
    };
  }

  async clickDashboardRequestTourCandidate(candidate: DashboardTourCandidate) {
    await this.closeAssistantChatIfVisible();
    await expect(
      candidate.requestTourButton,
      'Expected dashboard Request a tour CTA to be visible.',
    ).toBeVisible();
    await candidate.requestTourButton.click({ position: { x: 16, y: 16 }, timeout: 20000 });
  }

  async clickDashboardRequestTourForProperty(propertyCard: Locator) {
    await this.clickDashboardRequestTourCandidate({
      propertyCard,
      requestTourButton: this.requestTourCtaForProperty(propertyCard),
    });
  }

  async findDashboardPropertyCardByIdentifier(
    propertyIdentifier: PropertyIdentifier,
    maxHorizontalAttempts = 8,
  ) {
    await this.goToDashboardForTourVerification();
    const section = this.newListingsForYouSection();

    if (!(await section.isVisible({ timeout: 5000 }).catch(() => false))) {
      return undefined;
    }

    await this.scrollDashboardListingSectionIntoView(section);

    for (let attempt = 0; attempt <= maxHorizontalAttempts; attempt += 1) {
      const propertyCard = this.dashboardPropertyCardByIdentifierInSection(
        section,
        propertyIdentifier,
      );

      if (await propertyCard.isVisible({ timeout: 1000 }).catch(() => false)) {
        return propertyCard;
      }

      if (!(await this.advanceDashboardPropertyCarousel(section))) {
        break;
      }
    }

    return undefined;
  }

  private parseActiveTourStateCode(
    profileText: string,
  ): Extract<TourSearchStateCode, 'FL' | 'GA'> | undefined {
    const lines = profileText
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const statePattern = /\b(Florida|FL|Georgia|GA)\b/i;

    for (let index = 0; index < lines.length; index += 1) {
      if (!/active state|service state|buying state|state/i.test(lines[index]!)) {
        continue;
      }

      const nearbyText = lines.slice(index, index + 4).join(' ');
      const match = nearbyText.match(statePattern);

      if (match) {
        return this.toSupportedStateCode(match[1]!);
      }
    }

    const fullTextMatch = profileText.match(
      /(?:active state|service state|buying state|state)\s*:?\s*(Florida|FL|Georgia|GA)\b/i,
    );

    if (fullTextMatch) {
      return this.toSupportedStateCode(fullTextMatch[1]!);
    }

    const hasFlorida = /\b(Florida|FL)\b/i.test(profileText);
    const hasGeorgia = /\b(Georgia|GA)\b/i.test(profileText);

    if (hasFlorida !== hasGeorgia) {
      return hasFlorida ? 'FL' : 'GA';
    }

    return undefined;
  }

  private toSupportedStateCode(value: string): Extract<TourSearchStateCode, 'FL' | 'GA'> {
    return /^(fl|florida)$/i.test(value) ? 'FL' : 'GA';
  }

  private profileMenuButton() {
    return this.page.getByRole('button', { name: /profile menu/i }).first();
  }

  private async isLoggedIn() {
    if (/\/(?:login|register)(?:\/|\?|$)/.test(this.page.url())) {
      return false;
    }

    const profileMenuVisible = await this.profileMenuButton()
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    return profileMenuVisible && !(await this.hasPlaceholderProfile());
  }

  private async restoreDashboardSession(returnUrl?: string) {
    this.ensurePageOpen();

    const targetUrl = returnUrl ?? '/dashboard';

    await this.page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
    await this.page
      .waitForURL(
        (url) =>
          url.pathname.startsWith('/dashboard') ||
          /\/(?:login|register)(?:\/|$)/.test(url.pathname),
        { timeout: 15000 },
      )
      .catch(() => undefined);

    if (await this.isLoggedIn()) {
      return true;
    }

    const dashboardLinkOrButton = this.dashboardEntry();

    if (await dashboardLinkOrButton.isVisible({ timeout: 20000 }).catch(() => false)) {
      await dashboardLinkOrButton.click();
    } else {
      await this.page.goto('/dashboard');
    }

    await this.page
      .waitForURL(
        (url) =>
          url.pathname.startsWith('/dashboard') ||
          /\/(?:login|register)(?:\/|$)/.test(url.pathname),
        {
          timeout: 15000,
        },
      )
      .catch(() => undefined);

    if (await this.isLoggedIn()) {
      if (returnUrl && this.currentDashboardUrl() !== returnUrl) {
        await this.page.goto(returnUrl);
        await expect(this.page).toHaveURL(/dashboard/);
        await this.expectDashboardShell();
      }

      return true;
    }

    return false;
  }

  private async loginDirectly(role: Role) {
    this.ensurePageOpen();

    const { email, password } = this.getCredentials(role);
    const loginPage = new LoginPage(this.page);

    await this.openLoginPageForFreshAuth();
    await loginPage.loginWithEmail(email, password);
    await loginPage.dismissPrivacyBannerIfVisible();
    await this.expectDashboardReady();
  }

  private dashboardEntry() {
    return this.page
      .getByRole('link', { name: /go to dashboard/i })
      .or(this.page.getByRole('button', { name: /go to dashboard/i }))
      .first();
  }

  private async expectDashboardShell() {
    await expect(
      this.page,
      'Expected authenticated dashboard shell, not a logged-out auth page.',
    ).not.toHaveURL(/\/(?:login|register)(?:\/|\?|$)/);
    await this.expectAuthenticatedProfileMenu();
  }

  private currentDashboardUrl() {
    const currentUrl = this.page.url();

    if (!currentUrl.startsWith('http') || /\/(?:login|register)(?:\/|\?|$)/.test(currentUrl)) {
      return undefined;
    }

    const url = new URL(currentUrl);

    return url.pathname.startsWith('/dashboard') ? `${url.pathname}${url.search}` : undefined;
  }

  private isDashboardPage() {
    try {
      return new URL(this.page.url()).pathname.startsWith('/dashboard');
    } catch {
      return false;
    }
  }

  private getCredentials(role: Role) {
    const email = process.env[`${PREFIX}_${role}_EMAIL`];
    const password = process.env[`${PREFIX}_${role}_PASSWORD`];

    if (!email || !password) {
      throw new Error(
        `Missing credentials for role "${role}". Expected: ${PREFIX}_${role}_EMAIL and ${PREFIX}_${role}_PASSWORD`,
      );
    }

    return { email, password };
  }

  private ensurePageOpen() {
    if (this.page.isClosed()) {
      throw new Error(
        'Cannot restore the authenticated session because the Playwright page is closed.',
      );
    }
  }

  private async expectAuthenticatedProfileMenu() {
    const profileMenuButton = this.profileMenuButton();

    await expect(
      profileMenuButton,
      'Expected logged-in profile menu in the side navigation.',
    ).toBeVisible({ timeout: 30000 });
    await expect
      .poll(async () => !(await this.hasPlaceholderProfile()), {
        message: 'Expected a real logged-in profile, not the logged-out "Your Name" placeholder.',
        timeout: 30000,
      })
      .toBe(true);
  }

  private async hasPlaceholderProfile() {
    const profileText = (
      await this.profileMenuButton()
        .innerText()
        .catch(() => '')
    )
      .replace(/\s+/g, ' ')
      .trim();

    return /^(YN|Your Name)$/i.test(profileText);
  }

  private async openLoginPageForFreshAuth() {
    const signInHeading = this.page.getByRole('heading', { name: /sign in to your account/i });

    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (await signInHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
      return;
    }

    await this.clearStaleAuthState();
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });

    if (await signInHeading.isVisible({ timeout: 20000 }).catch(() => false)) {
      return;
    }

    await this.page.goto('/', { waitUntil: 'domcontentloaded' });

    const loginLink = this.page.getByRole('link', { name: /login|sign in/i }).first();

    await expect(loginLink, 'Expected Login link after clearing stale auth state.').toBeVisible({
      timeout: 30000,
    });
    await loginLink.click();
    await expect(signInHeading).toBeVisible({ timeout: 30000 });
  }

  private async clearStaleAuthState() {
    const context = this.page.context();
    await context.clearCookies();

    await this.page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await this.page
      .evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      })
      .catch(() => undefined);
  }

  private async openToursPageFromDashboardTourSection() {
    const upcomingToursHeading = await this.expectUpcomingToursSection();

    await upcomingToursHeading.scrollIntoViewIfNeeded();

    const upcomingToursSection = upcomingToursHeading
      .locator(
        'xpath=ancestor::*[self::section or self::div][.//a[contains(@href, "/dashboard/tours")] or .//button][1]',
      )
      .first();
    const viewAllTours = upcomingToursSection
      .getByRole('link', { name: /view all/i })
      .or(upcomingToursSection.getByRole('button', { name: /view all/i }))
      .or(upcomingToursSection.locator('a[href*="/dashboard/tours"]'))
      .or(upcomingToursSection.locator('button[aria-label*="view" i], button[title*="view" i]'))
      .or(upcomingToursSection.locator('button').filter({ has: this.page.locator('svg') }))
      .first();

    await expect(
      viewAllTours,
      'Expected View All control in the Upcoming Tours dashboard section.',
    ).toBeVisible({ timeout: 20000 });
    await viewAllTours.click();
    await this.page.waitForURL((url) => url.pathname === '/dashboard/tours', {
      timeout: 15000,
    });
  }

  private async goToDashboardForTourVerification() {
    const dashboardSignal = this.dashboardTourVerificationSignal();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
      await this.page
        .waitForURL((url) => url.pathname === '/dashboard', { timeout: 15000 })
        .catch(() => undefined);

      if (await dashboardSignal.isVisible({ timeout: 15000 }).catch(() => false)) {
        return;
      }
    }

    await expect(
      dashboardSignal,
      'Expected Hub dashboard to load before checking requested tours.',
    ).toBeVisible({ timeout: 30000 });
  }

  private dashboardTourVerificationSignal() {
    return this.page
      .getByRole('heading', { name: /upcoming tours/i })
      .or(this.page.getByText(/upcoming tours/i))
      .or(this.page.getByRole('link', { name: /^tours$/i }))
      .or(this.page.getByRole('button', { name: /^tours$/i }))
      .first();
  }

  private async expectUpcomingToursSection() {
    const upcomingToursHeading = this.page
      .getByRole('heading', { name: /upcoming tours/i })
      .or(this.page.getByText(/upcoming tours/i))
      .first();

    await expect(
      upcomingToursHeading,
      'Expected Upcoming Tours section to be visible on the dashboard.',
    ).toBeVisible({ timeout: 30000 });

    return upcomingToursHeading;
  }

  private dashboardVisiblePropertyCards() {
    return this.page.locator('div[class*="group/property-card"]').filter({ visible: true });
  }

  private dashboardListingSection(name: RegExp) {
    return this.page
      .getByRole('heading', { name })
      .first()
      .locator(
        'xpath=ancestor::*[(self::section or self::div) and .//a[contains(@href, "/dashboard/property/")]][1]',
      );
  }

  private newListingsForYouSection() {
    return this.dashboardListingSection(/new listings for you/i);
  }

  private newListingsForYouHeading() {
    return this.page.getByRole('heading', { name: /new listings for you/i }).first();
  }

  private visiblePropertyCardsInSection(section: Locator) {
    return section.locator('div[class*="group/property-card"]').filter({ visible: true });
  }

  private requestTourButtonsInSection(section: Locator) {
    return section
      .locator('button, a, [role="button"]')
      .filter({ hasText: /request a tour/i })
      .filter({ visible: true });
  }

  private dashboardPropertyCardByIdentifierInSection(
    section: Locator,
    propertyIdentifier: PropertyIdentifier,
  ) {
    if (propertyIdentifier.propertyId) {
      return section
        .locator('div[class*="group/property-card"]')
        .filter({ has: this.page.locator(`a[href*="${propertyIdentifier.propertyId}"]`) })
        .first();
    }

    return section
      .locator('div[class*="group/property-card"]')
      .filter({ hasText: propertyIdentifier.titleOrAddress })
      .first();
  }

  private async getDashboardPropertyTitleOrAddress(propertyCard: Locator) {
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

  private async getDashboardPropertyId(propertyCard: Locator) {
    const propertyDetailUrl = await propertyCard
      .locator('a[href*="/dashboard/property/"]')
      .first()
      .getAttribute('href');

    return propertyDetailUrl?.split('/').filter(Boolean).pop();
  }

  private requestTourCtaForProperty(propertyCard: Locator) {
    return propertyCard
      .getByRole('button', { name: /request a tour/i })
      .or(propertyCard.getByRole('link', { name: /request a tour/i }))
      .or(propertyCard.locator('button, a, [role="button"]').filter({ hasText: /request a tour/i }))
      .first();
  }

  private propertyCardFromRequestTourButton(requestTourButton: Locator) {
    return requestTourButton
      .locator(
        'xpath=ancestor::*[(self::div or self::article or self::section) and .//a[contains(@href, "/dashboard/property/")] and (.//button[contains(., "Request a tour")] or .//a[contains(., "Request a tour")])][1]',
      )
      .first();
  }

  private async randomClickableButtonIndex(buttons: Locator) {
    const candidates = await buttons.evaluateAll((elements) => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return elements
        .map((element, index) => {
          const button = element as HTMLElement;
          const box = button.getBoundingClientRect();
          const style = window.getComputedStyle(button);
          const clickX = Math.min(box.right - 1, box.left + 16);
          const clickY = Math.min(box.bottom - 1, box.top + 16);
          const hitElement = document.elementFromPoint(clickX, clickY);
          const disabled =
            button.hasAttribute('disabled') ||
            button.getAttribute('aria-disabled') === 'true' ||
            style.pointerEvents === 'none';

          return {
            index,
            eligible:
              box.width > 0 &&
              box.height > 0 &&
              clickX > 0 &&
              clickX < viewportWidth &&
              clickY > 0 &&
              clickY < viewportHeight &&
              Boolean(hitElement && button.contains(hitElement)) &&
              style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              !disabled,
          };
        })
        .filter((candidate) => candidate.eligible)
        .map((candidate) => candidate.index);
    });

    return candidates.length > 0 ? this.randomItem(candidates) : undefined;
  }

  private async advanceDashboardPropertyCarousel(section: Locator) {
    if (!(await section.isVisible({ timeout: 1000 }).catch(() => false))) {
      return false;
    }

    await this.scrollDashboardListingSectionIntoView(section);

    const nextButton = this.dashboardCarouselNextButton(section);

    let movedByButton = false;
    if (
      (await nextButton.isVisible().catch(() => false)) &&
      !(await this.isDisabledLike(nextButton))
    ) {
      await nextButton.scrollIntoViewIfNeeded().catch(() => undefined);
      await nextButton.click().catch(() => undefined);
      await this.page.waitForTimeout(600);
      movedByButton = true;
    }

    const moved = await this.scrollDashboardCarouselContainer(section);

    if (moved) {
      await this.page.waitForTimeout(400);
    }

    return movedByButton || moved;
  }

  private dashboardCarouselNextButton(section: Locator) {
    return section
      .getByRole('button', { name: /next slide/i })
      .or(section.locator('button[aria-label*="next slide" i]'))
      .or(section.getByRole('button', { name: /next|right|forward/i }))
      .or(section.locator('button[aria-label*="next" i], button[aria-label*="right" i]'))
      .or(section.locator('button[title*="next" i], button[title*="right" i]'))
      .filter({ visible: true })
      .last();
  }

  private async scrollDashboardCarouselContainer(section: Locator) {
    const moved = await section.evaluate((root) => {
      const candidates = Array.from(root.querySelectorAll<HTMLElement>('*')).filter((element) => {
        if (element.scrollWidth <= element.clientWidth + 24) {
          return false;
        }

        const style = window.getComputedStyle(element);

        if (!/(auto|scroll|overlay)/.test(style.overflowX)) {
          return false;
        }

        return Boolean(element.querySelector('div[class*="group/property-card"]'));
      });

      let scrolled = false;

      for (const element of candidates) {
        const previousLeft = element.scrollLeft;
        const maxLeft = element.scrollWidth - element.clientWidth;

        if (previousLeft >= maxLeft - 2) {
          continue;
        }

        element.scrollLeft = Math.min(
          maxLeft,
          previousLeft + Math.max(element.clientWidth * 0.85, 320),
        );
        scrolled = scrolled || element.scrollLeft !== previousLeft;
      }

      return scrolled;
    });

    return moved;
  }

  private async scrollDashboardListingSectionIntoView(section: Locator) {
    const heading = section.getByRole('heading').first();

    if (await heading.isVisible({ timeout: 1000 }).catch(() => false)) {
      await heading.scrollIntoViewIfNeeded().catch(() => undefined);
      return;
    }

    await section.scrollIntoViewIfNeeded().catch(() => undefined);
  }

  private async scrollToNewListingsForYou() {
    const heading = this.newListingsForYouHeading();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      if (await heading.isVisible({ timeout: 750 }).catch(() => false)) {
        await heading.scrollIntoViewIfNeeded().catch(() => undefined);
        return;
      }

      await this.page.evaluate(() => {
        window.scrollBy({ top: Math.max(window.innerHeight * 0.8, 600), behavior: 'instant' });
      });
    }
  }

  private async closeAssistantChatIfVisible() {
    const closeChatButton = this.page.getByRole('button', { name: /close chat/i }).first();

    if (await closeChatButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeChatButton.click().catch(() => undefined);
      await expect(closeChatButton)
        .toBeHidden({ timeout: 5000 })
        .catch(() => undefined);
    }
  }

  private async waitForDashboardListingCards() {
    await expect
      .poll(
        async () => {
          const listingLinkCount = await this.page
            .locator('a[href*="/dashboard/property/"]')
            .count()
            .catch(() => 0);

          return listingLinkCount > 0;
        },
        {
          timeout: 30000,
          message:
            'Expected dashboard listing sections to hydrate with property cards before scanning tour CTAs.',
        },
      )
      .toBe(true);
  }

  private async openToursPageFromSideNav() {
    const toursNavItem = this.page
      .getByRole('link', { name: /^tours$/i })
      .or(this.page.getByRole('button', { name: /^tours$/i }))
      .or(this.page.locator('a[href="/dashboard/tours"], a[href*="/dashboard/tours"]').first())
      .first();

    await expect(toursNavItem, 'Expected Tours entry in the side navigation.').toBeVisible({
      timeout: 30000,
    });
    await toursNavItem.click();
    await this.page.waitForURL((url) => url.pathname === '/dashboard/tours', {
      timeout: 15000,
    });
  }

  private async openProfileMenu() {
    await this.goToDashboard();

    const profileMenuButton = this.profileMenuButton();

    await expect(
      profileMenuButton,
      'Expected profile menu button in Hub side navigation.',
    ).toBeVisible({
      timeout: 30000,
    });
    await profileMenuButton.click();

    const menu = this.profileMenu();

    await expect(
      menu,
      'Expected profile menu popup with profile options and Active state.',
    ).toBeVisible({ timeout: 20000 });

    return menu;
  }

  private async closeProfileMenu() {
    await this.page.keyboard.press('Escape');
    await expect(this.profileMenu())
      .toBeHidden({ timeout: 5000 })
      .catch(() => undefined);
  }

  private profileMenu() {
    return this.page
      .getByRole('menu')
      .or(
        this.page
          .locator(
            '[data-radix-popper-content-wrapper], [data-slot="dropdown-menu-content"], [data-slot="popover-content"], [role="menu"]',
          )
          .filter({ hasText: /active state|profile|notification|log out|logout|sign out/i }),
      )
      .last();
  }

  private tourTimeDialog() {
    return this.dialogWithText(/tour|date|time|schedule|slot/i);
  }

  private phoneNumberDialog() {
    return this.dialogWithText(/phone|contact|mobile/i);
  }

  private buyerAgreementDialog() {
    return this.dialogWithText(/buyer agreement|sign.*agreement/i);
  }

  private dialogWithText(text: RegExp) {
    return this.page
      .getByRole('dialog')
      .filter({ hasText: text })
      .or(
        this.page
          .locator('[data-radix-dialog-content], [data-slot="dialog-content"], [role="dialog"]')
          .filter({ hasText: text }),
      )
      .last();
  }

  private dateButtons(dialog: Locator) {
    return dialog
      .getByRole('option')
      .filter({ hasText: DATE_TEXT_PATTERN })
      .or(
        dialog
          .locator('button, [role="button"]')
          .filter({ hasText: DATE_TEXT_PATTERN })
          .filter({ hasNotText: /continue|cancel|close|back/i }),
      );
  }

  private timeSlotButtons(dialog: Locator) {
    return dialog.getByRole('checkbox', { name: TIME_TEXT_PATTERN }).or(
      dialog
        .locator('button, [role="button"]')
        .filter({ hasText: TIME_TEXT_PATTERN })
        .filter({ hasNotText: /continue|cancel|close|back/i }),
    );
  }

  private disabledTimeSlotButtons(dialog: Locator) {
    return dialog
      .locator(
        'button[disabled], button[aria-disabled="true"], button[data-disabled], button[data-state="disabled"], input[type="checkbox"][disabled], [role="checkbox"][aria-disabled="true"], [role="checkbox"][data-disabled], [role="checkbox"][data-state="disabled"], [role="button"][aria-disabled="true"], [role="button"][data-disabled], [role="button"][data-state="disabled"]',
      )
      .filter({ hasText: TIME_TEXT_PATTERN });
  }

  private selectedButtons(dialog: Locator) {
    return dialog.locator(
      'button[aria-selected="true"], button[aria-pressed="true"], button[data-selected="true"], button[data-state="checked"], input[type="checkbox"]:checked, [role="checkbox"][aria-checked="true"], [role="checkbox"][data-state="checked"], [role="button"][aria-selected="true"], [role="button"][aria-pressed="true"], [role="option"][aria-selected="true"]',
    );
  }

  private async selectedOptionCount(dialog: Locator, textPattern: RegExp) {
    return this.selectedButtons(dialog).filter({ hasText: textPattern }).count();
  }

  private async hasTimeSlotControls(dialog: Locator) {
    if (!(await dialog.isVisible().catch(() => false))) {
      return false;
    }

    const continueButton = dialog.getByRole('button', { name: /continue/i }).first();
    if (await continueButton.isVisible().catch(() => false)) {
      return true;
    }

    const [dateCount, timeCount] = await Promise.all([
      this.dateButtons(dialog)
        .count()
        .catch(() => 0),
      this.timeSlotButtons(dialog)
        .count()
        .catch(() => 0),
    ]);

    return dateCount > 0 || timeCount > 0;
  }

  private randomItem<T>(items: T[]) {
    expect(items.length, 'Expected at least one item to select randomly.').toBeGreaterThan(0);

    return items[Math.floor(random() * items.length)]!;
  }

  private async tryClickTwoOptions(options: Locator) {
    const enabledOptions = await this.enabledOptions(options, 2);

    for (const option of enabledOptions) {
      await option.scrollIntoViewIfNeeded();
      await option.click();
    }
  }

  private async clickFirstEnabledOption(options: Locator, required: boolean) {
    const enabledOptions = await this.enabledOptions(options, 1);
    const option = enabledOptions[0];

    if (!option) {
      if (required) {
        throw new Error('Expected at least one enabled tour date/time option.');
      }

      return undefined;
    }

    await option.scrollIntoViewIfNeeded();
    const optionText = (await option.innerText()).replace(/\s+/g, ' ').trim();
    await option.click();

    return optionText;
  }

  private async enabledOptions(options: Locator, maxOptions: number) {
    const count = await options.count();
    const enabledOptions: Locator[] = [];

    for (let index = 0; index < count && enabledOptions.length < maxOptions; index += 1) {
      const option = options.nth(index);

      if (!(await option.isVisible().catch(() => false))) {
        continue;
      }

      if (await this.isDisabledLike(option)) {
        continue;
      }

      enabledOptions.push(option);
    }

    return enabledOptions;
  }

  private phoneInput(dialog: Locator) {
    return dialog
      .getByRole('textbox', { name: /phone|mobile/i })
      .or(dialog.locator('input[type="tel"]'))
      .or(dialog.locator('input[name*="phone" i]'))
      .first();
  }

  private async selectNepalCountryCode(dialog: Locator) {
    const countrySelector = dialog
      .getByRole('combobox')
      .or(dialog.getByRole('button').filter({ hasText: /\+\d|United States|US|country/i }))
      .first();

    await expect(countrySelector, 'Expected country selector in phone modal.').toBeVisible();
    await countrySelector.click();

    const countrySearch = this.page
      .getByRole('textbox', { name: /search|country/i })
      .or(this.page.locator('input[placeholder*="country" i], input[placeholder*="search" i]'))
      .first();

    if (await countrySearch.isVisible({ timeout: 2000 }).catch(() => false)) {
      await countrySearch.fill('Nepal');
    }

    const nepalOption = this.page
      .getByRole('option', { name: /Nepal|\+977/i })
      .or(this.page.getByText(/Nepal|\+977/))
      .first();

    await expect(nepalOption, 'Expected Nepal country option to be available.').toBeVisible({
      timeout: 20000,
    });
    await nepalOption.click();
    await expect(dialog, 'Expected Nepal +977 country code to be selected.').toContainText(
      /Nepal|\+977/,
    );
  }

  private randomNepalPhoneNumber() {
    const suffix = Math.floor(10_000_000 + random() * 90_000_000);

    return `98${String(suffix).slice(0, 8)}`;
  }

  private async validateCobuyerFields(dialog: Locator) {
    const cobuyerToggle = this.cobuyerToggle(dialog);

    if (!(await cobuyerToggle.isVisible({ timeout: 5000 }).catch(() => false))) {
      return;
    }

    await this.setCobuyerToggle(dialog, true);

    const fullNameInput = dialog
      .getByRole('textbox', { name: /full name|name/i })
      .or(dialog.locator('input[name*="name" i], input[placeholder*="name" i]'))
      .first();
    const emailInput = dialog
      .getByRole('textbox', { name: /email/i })
      .or(
        dialog.locator(
          'input[type="email"], input[name*="email" i], input[placeholder*="email" i]',
        ),
      )
      .first();

    await expect(fullNameInput, 'Expected cobuyer full name field to expand.').toBeVisible();
    await expect(emailInput, 'Expected cobuyer email field to expand.').toBeVisible();

    const signButton = dialog.getByRole('button', { name: /sign buyer agreement/i }).first();

    await expect(signButton).toBeVisible();
    await signButton.click();
    await expect(
      dialog
        .locator('[role="alert"], [data-slot="form-message"]')
        .or(dialog.getByText(/required|full name|email/i))
        .first(),
      'Expected missing cobuyer details validation.',
    ).toBeVisible({ timeout: 5000 });

    await this.setCobuyerToggle(dialog, false);
    await expect(fullNameInput, 'Expected cobuyer full name field to collapse.').toBeHidden({
      timeout: 5000,
    });
  }

  private cobuyerToggle(dialog: Locator) {
    const namedToggle = dialog
      .getByRole('checkbox', { name: /co-?buyer/i })
      .or(dialog.getByRole('switch', { name: /co-?buyer/i }));
    const rowToggle = dialog
      .locator('label, div, [data-slot]')
      .filter({ hasText: /i have a co-?buyer/i })
      .locator(
        '[role="switch"], [role="checkbox"], button[role="switch"], button[role="checkbox"], input[type="checkbox"]',
      );

    return namedToggle.or(rowToggle).first();
  }

  private async setCobuyerToggle(dialog: Locator, checked: boolean) {
    const cobuyerToggle = this.cobuyerToggle(dialog);

    await expect(cobuyerToggle, 'Expected co-buyer toggle to be visible.').toBeVisible();

    if ((await this.isToggleChecked(cobuyerToggle)) !== checked) {
      await cobuyerToggle.click();
    }

    await expect
      .poll(async () => await this.isToggleChecked(this.cobuyerToggle(dialog)), {
        message: `Expected co-buyer toggle to be ${checked ? 'enabled' : 'disabled'}.`,
      })
      .toBe(checked);
  }

  private async isToggleChecked(locator: Locator) {
    const [isChecked, ariaChecked, checkedAttribute, dataState] = await Promise.all([
      locator.isChecked().catch(() => false),
      locator.getAttribute('aria-checked').catch(() => null),
      locator.getAttribute('checked').catch(() => null),
      locator.getAttribute('data-state').catch(() => null),
    ]);

    return (
      isChecked || ariaChecked === 'true' || checkedAttribute !== null || dataState === 'checked'
    );
  }

  private async exitBuyerAgreement(dialog: Locator) {
    await this.closeDialog(dialog);

    const exitConfirmation = this.dialogWithText(/go back to sign|exit anyway|leave|exit/i);
    await expect(exitConfirmation, 'Expected buyer agreement exit confirmation modal.').toBeVisible(
      {
        timeout: 20000,
      },
    );

    await exitConfirmation
      .getByRole('button', { name: /go back to sign|go back/i })
      .first()
      .click();
    await expect(
      this.buyerAgreementDialog(),
      'Expected to return to buyer agreement modal.',
    ).toBeVisible({
      timeout: 20000,
    });

    await this.closeDialog(this.buyerAgreementDialog());
    await expect(
      exitConfirmation,
      'Expected buyer agreement exit confirmation modal again.',
    ).toBeVisible({
      timeout: 20000,
    });
    await exitConfirmation
      .getByRole('button', { name: /exit anyway|exit|leave/i })
      .first()
      .click();
    await expect(exitConfirmation).toBeHidden({ timeout: 20000 });
  }

  private async closeDialog(dialog: Locator) {
    const closeButton = dialog
      .getByRole('button', { name: /close|cancel/i })
      .or(dialog.locator('button[aria-label*="close" i]'))
      .first();

    await expect(closeButton, 'Expected dialog close button.').toBeVisible();
    await closeButton.click();
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
}
