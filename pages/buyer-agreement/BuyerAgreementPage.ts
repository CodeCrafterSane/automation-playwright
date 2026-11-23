import { expect, Page } from '@playwright/test';
import LoginPage from '../auth/LoginPage';

const EXPECTED_CA_RESTRICTION_MESSAGE =
  'A licensed real estate expert from the listing provider by the platform will reach out to help you take the next step.';

export default class BuyerAgreementPage {
  constructor(private page: Page) {}

  async loginWithDedicatedBuyer(email: string, password: string) {
    const loginPage = new LoginPage(this.page);

    await loginPage.goto();
    await loginPage.openLogin();
    await loginPage.dismissPrivacyBannerIfVisible();
    await loginPage.continueWithEmail();
    await loginPage.enterEmail(email);
    await this.clickContinueWithFallback();

    const passwordInput = this.page.getByRole('textbox', { name: 'Password' });

    if (!(await passwordInput.isVisible({ timeout: 20000 }).catch(() => false))) {
      await this.clickContinueWithFallback();
    }

    await expect(
      passwordInput,
      'Expected password field after submitting CA buyer email.',
    ).toBeVisible({
      timeout: 30000,
    });
    await loginPage.enterPassword(password);
    await this.clickContinueWithFallback();
    await this.page.waitForURL(/dashboard|profile|onboarding/, { timeout: 30000 });
    await loginPage.dismissPrivacyBannerIfVisible();
  }

  async expectCaliforniaRestriction() {
    await expect(
      this.page.getByText(EXPECTED_CA_RESTRICTION_MESSAGE, { exact: true }),
      'Expected California buyer agreement restriction support message.',
    ).toBeVisible({ timeout: 30000 });

    await expect
      .poll(
        async () =>
          await this.directBuyerAgreementSigningActions().filter({ visible: true }).count(),
        { message: 'Expected no direct Buyer Agreement signing CTA/action for California user.' },
      )
      .toBe(0);
  }

  private async clickContinueWithFallback() {
    const continueButton = this.page.getByRole('button', {
      name: 'Continue',
      exact: true,
    });

    await expect(continueButton, 'Expected Continue button in email login form.').toBeVisible({
      timeout: 20000,
    });
    await expect(continueButton).toBeEnabled({ timeout: 20000 });

    try {
      await continueButton.click({ timeout: 20000 });
    } catch {
      await this.page.keyboard.press('Enter');
    }
  }

  private directBuyerAgreementSigningActions() {
    const directSigningActionPattern =
      /sign buyer agreement|sign agreement|review and sign|start signing|continue to sign|proceed to sign|start buyer agreement/i;

    return this.page
      .getByRole('button', { name: directSigningActionPattern })
      .or(this.page.getByRole('link', { name: directSigningActionPattern }))
      .or(
        this.page
          .locator('button, a, [role="button"]')
          .filter({ hasText: directSigningActionPattern }),
      );
  }
}
