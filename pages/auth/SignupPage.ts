import { expect, Page } from '@playwright/test';
import env from '../../utils/env';

export default class SignupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto(env.baseURL);
  }

  async openSignup() {
    await this.page.getByRole('button', { name: 'Sign up' }).first().click();
    await this.page.waitForURL(/register/);
  }

  async continueWithEmail() {
    await this.page.getByRole('button', { name: 'Continue with email' }).click();
  }

  async enterName(name: string) {
    await this.page.getByRole('textbox', { name: 'Name' }).fill(name);
  }

  async enterEmail(email: string) {
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
  }

  async enterPassword(password: string) {
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
  }

  async expectTurnstileErrorMessageVisible() {
    await expect(
      this.page.getByText("We couldn't complete the security check. Refresh to try again."),
    ).toBeVisible();
  }

  async clickContinue() {
    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async enterVerificationCode(code: string) {
    const verificationCodeInput = this.page.locator('[id="_r_0_-form-item"]');

    await expect(verificationCodeInput).toBeVisible();
    await verificationCodeInput.fill(code);
  }

  async expectVerificationCodeMismatchMessage() {
    await expect(this.page.getByText('Invalid verification code provided')).toBeVisible();
  }

  async requestAnotherVerificationCode() {
    await this.page.getByRole('button', { name: 'Request another code' }).click();
  }

  async expectOtpCodeSentMessage(email: string) {
    await expect(this.page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
    await expect(this.page.getByText(`We’ve sent verification code to ${email}`)).toBeVisible();
  }

  async clickVerifyLater() {
    await this.page.getByRole('button', { name: 'Verify later' }).click();
  }

  async gotoPhoneNumberPage() {
    await this.page.goto(`${env.baseURL}/personal/phone-number`);
  }

  async skipPhoneVerification() {
    await this.page.getByRole('button', { name: 'Skip phone verification' }).click();
  }

  async fillEmailSignupForm(name: string, email: string, password: string) {
    await this.continueWithEmail();
    await this.enterName(name);
    await this.enterEmail(email);
    await this.enterPassword(password);
  }

  async expectEmailSignupFormVisible() {
    await expect(this.page.getByRole('textbox', { name: 'Name' })).toBeVisible();
    await expect(this.page.getByRole('textbox', { name: 'Email' })).toBeVisible();
    await expect(this.page.getByRole('textbox', { name: 'Password' })).toBeVisible();
  }

  async fullSignupFormEntry(name: string, email: string, password: string) {
    await this.goto();
    await this.openSignup();
    await this.fillEmailSignupForm(name, email, password);
    await this.clickContinue();
  }
}
