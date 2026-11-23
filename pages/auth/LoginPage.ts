import { expect, Page } from '@playwright/test';
import env from '../../utils/env';

export default class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    const currentUrl = this.page.url();
    if (currentUrl && currentUrl.startsWith(env.baseURL)) {
      return;
    }

    try {
      await this.page.goto(env.baseURL, { waitUntil: 'domcontentloaded' });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('net::ERR_ABORTED')) {
        return;
      }
      throw error;
    }
  }

  async openLogin() {
    await this.page
      .getByRole('link', { name: 'Login' })
      .or(this.page.getByRole('button', { name: 'Login' }))
      .first()
      .click();
    await this.page.waitForURL(/login/);
    await expect(this.page.getByRole('heading', { name: 'Sign in to your account' })).toBeVisible();
  }

  async loginWithEmail(email: string, password: string) {
    await this.continueWithEmail();
    await this.enterEmail(email);
    await this.clickContinue();
    await this.enterPassword(password);
    await this.clickContinue();
    await this.waitForPostAuthSuccess();
  }

  /**
   * Post-login lands on /setting-up-profile, then routes to /personal/* or /dashboard*
   * (or an explicit expectedPath from the caller). Auth routes, /404, and /error are
   * failures — never success. Failure/auth routes cannot be treated as post-auth success.
   */
  async waitForPostAuthSuccess(timeout = 30_000, expectedPath?: string) {
    const isSetupPath = (pathname: string) => /\/setting-up-profile(\/|$)/.test(pathname);
    const isFailurePath = (pathname: string) =>
      /\/(login|verify|register)(\/|$)/.test(pathname) || /\/(404|error)(\/|$)/.test(pathname);

    let validatedExpectedPath: string | undefined;
    if (expectedPath) {
      validatedExpectedPath = expectedPath.startsWith('/') ? expectedPath : `/${expectedPath}`;
      if (isFailurePath(validatedExpectedPath)) {
        throw new Error(
          `Invalid expectedPath '${expectedPath}': failure/auth routes (/login, /verify, /register, /404, /error) cannot be treated as post-auth success.`,
        );
      }
    }

    const isSuccessPath = (pathname: string) => {
      if (
        pathname === '/personal' ||
        pathname.startsWith('/personal/') ||
        pathname.startsWith('/dashboard') ||
        pathname.startsWith('/onboarding')
      ) {
        return true;
      }
      if (validatedExpectedPath) {
        return (
          pathname === validatedExpectedPath || pathname.startsWith(`${validatedExpectedPath}/`)
        );
      }
      return false;
    };
    const isTerminalPath = (pathname: string) => isSuccessPath(pathname) || isFailurePath(pathname);

    const throwForFailure = (url: string) => {
      throw new Error(
        `Auth failed: landed on unfinished/auth or error route ${url}. ` +
          `/login, /verify, /register, /404, and /error are not post-auth success.`,
      );
    };
    const throwForUnexpected = (url: string) => {
      throw new Error(
        `Auth did not reach a post-auth destination; landed on ${url}. ` +
          `Expected /personal/*, /dashboard*${expectedPath ? `, or ${expectedPath}` : ''}.`,
      );
    };

    // Still on an auth page until navigation begins — treat same-href auth routes as non-terminal so
    // we do not resolve immediately; any URL change onto a failure path fails fast.
    const initialHref = this.page.url();

    try {
      await this.page.waitForURL(
        (url) => {
          const pathname = url.pathname;
          if (isSetupPath(pathname) || isSuccessPath(pathname)) {
            return true;
          }
          if (isFailurePath(pathname)) {
            if (/\/(login|verify|register)(\/|$)/.test(pathname)) {
              return url.href !== initialHref;
            }
            return true;
          }
          return false;
        },
        { timeout, waitUntil: 'commit' },
      );
    } catch (error) {
      const pathname = new URL(this.page.url()).pathname;
      if (isFailurePath(pathname)) {
        throwForFailure(this.page.url());
      }
      if (isSetupPath(pathname)) {
        throw new Error(
          `Auth stuck on setting-up-profile: ${this.page.url()}. ` +
            `Expected /personal/*, /dashboard*${expectedPath ? `, or ${expectedPath}` : ''}.`,
        );
      }
      throw error;
    }

    let pathname = new URL(this.page.url()).pathname;

    if (isFailurePath(pathname)) {
      throwForFailure(this.page.url());
    }
    if (isSuccessPath(pathname)) {
      return;
    }

    if (isSetupPath(pathname)) {
      try {
        await this.page.waitForURL((url) => isTerminalPath(url.pathname), {
          timeout,
          waitUntil: 'commit',
        });
      } catch (error) {
        pathname = new URL(this.page.url()).pathname;
        if (isSetupPath(pathname)) {
          throw new Error(
            `Auth stuck on setting-up-profile: ${this.page.url()}. ` +
              `Expected /personal/*, /dashboard*${expectedPath ? `, or ${expectedPath}` : ''}.`,
          );
        }
        if (isFailurePath(pathname)) {
          throwForFailure(this.page.url());
        }
        throw error;
      }

      pathname = new URL(this.page.url()).pathname;
      if (isFailurePath(pathname)) {
        throwForFailure(this.page.url());
      }
      if (isSuccessPath(pathname)) {
        return;
      }
      throwForUnexpected(this.page.url());
    }

    throwForUnexpected(this.page.url());
  }

  async continueWithEmail() {
    await this.page.getByRole('button', { name: 'Continue with email' }).click();
  }

  async enterEmail(email: string) {
    await this.page.getByRole('textbox', { name: 'Email' }).fill(email);
  }

  async clickContinue() {
    await this.page.getByRole('button', { name: 'Continue', exact: true }).click();
  }

  async enterPassword(password: string) {
    await this.page.getByRole('textbox', { name: 'Password' }).fill(password);
  }

  async requestPasswordlessCode(email: string) {
    await this.continueWithEmail();
    await this.enterEmail(email);
    await this.clickContinue();

    if (await this.isPasswordlessCodeEntryVisible()) {
      return;
    }

    await this.requestPasswordlessFromPasswordStep();
    await this.expectPasswordlessCodeEntry();
  }

  async requestPasswordlessFromPasswordStep() {
    const forgotPasswordCta = this.page.getByRole('button', { name: /forgot password/i }).first();
    const passwordlessCta = this.page
      .getByRole('button', {
        name: /passwordless|without password|magic link|one.?time|otp|verification|send.*code|email.*code/i,
      })
      .or(
        this.page.getByRole('link', {
          name: /passwordless|without password|magic link|one.?time|otp|verification|send.*code|email.*code/i,
        }),
      )
      .first();

    if (await forgotPasswordCta.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await forgotPasswordCta.click();
    } else {
      await expect(
        passwordlessCta,
        'Expected passwordless login action after submitting email.',
      ).toBeVisible({
        timeout: 30_000,
      });
      await passwordlessCta.click();
    }
  }

  async enterPasswordlessCode(code: string) {
    const digitInputs = this.page.locator(
      'input[inputmode="numeric"], input[type="tel"], input[autocomplete="one-time-code"]',
    );
    const digitInputCount = await digitInputs.count();

    if (digitInputCount >= code.length) {
      for (let index = 0; index < digitInputCount; index += 1) {
        await digitInputs.nth(index).fill('');
      }

      for (let index = 0; index < code.length; index += 1) {
        await digitInputs.nth(index).fill(code[index]!);
      }
    } else {
      const codeInput = this.passwordlessCodeInput();

      await expect(codeInput, 'Expected passwordless verification code input.').toBeVisible({
        timeout: 30_000,
      });
      await codeInput.fill('');
      await codeInput.fill(code);
    }

    await this.clickContinue();
  }

  async loginPasswordless(email: string, code: string) {
    await this.requestPasswordlessCode(email);
    await this.enterPasswordlessCode(code);
    await this.waitForPostAuthSuccess();
    await this.dismissPrivacyBannerIfVisible();
  }

  async expectPasswordlessCodeEntry() {
    const codeInput = this.passwordlessCodeInput();
    if (await codeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(codeInput, 'Expected passwordless verification code input.').toBeVisible({
        timeout: 30_000,
      });
      return;
    }

    await expect(
      this.page.getByRole('heading', { name: /verify|verification|code|check your email/i }),
      'Expected passwordless login to show the verification heading.',
    ).toBeVisible({ timeout: 30_000 });
  }

  async expectInvalidEmailMessage() {
    await expect(this.page.getByText('The given email is not valid')).toBeVisible();
  }

  async expectPasswordRequiredMessage() {
    await expect(this.page.getByText('Please enter your password')).toBeVisible();
  }

  async expectFailedLoginMessage() {
    await expect(
      this.page.getByRole('listitem').filter({ hasText: 'Failed to loginIncorrect username or' }),
    ).toBeVisible();
  }

  async expectInvalidPasswordlessCodeMessage() {
    await expect(this.page.getByText('Invalid code or auth state for the user.')).toBeVisible();
  }

  async requestAnotherPasswordlessCode() {
    await this.page.getByRole('button', { name: 'Request another code' }).click();
    await this.expectPasswordlessCodeEntry();
  }

  async fullLogin(email: string, password: string) {
    await this.goto();
    await this.openLogin();
    await this.loginWithEmail(email, password);
    await this.dismissPrivacyBannerIfVisible();
  }

  private passwordlessCodeInput() {
    return this.page
      .getByRole('textbox', { name: /verification|otp|code|one.?time|security/i })
      .or(
        this.page
          .locator(
            'input[name*="otp" i], input[name*="code" i], input[autocomplete="one-time-code"]',
          )
          .first(),
      )
      .or(this.page.locator('input').first())
      .first();
  }

  private async isPasswordlessCodeEntryVisible() {
    if (
      await this.passwordlessCodeInput()
        .isVisible({ timeout: 3_000 })
        .catch(() => false)
    ) {
      return true;
    }

    return this.page
      .getByRole('heading', { name: /verify|verification|code|check your email/i })
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
  }

  async dismissPrivacyBannerIfVisible() {
    const rejectOptionalCookiesButton = this.page
      .getByRole('button', { name: /reject optional/i })
      .first();

    if (await rejectOptionalCookiesButton.isVisible()) {
      await rejectOptionalCookiesButton.click();
      await expect(rejectOptionalCookiesButton)
        .toBeHidden({ timeout: 20000 })
        .catch(() => {});
    }
  }
}
