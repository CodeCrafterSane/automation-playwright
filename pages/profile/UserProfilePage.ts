import { expect, Page } from '@playwright/test';

export type SupportedProfileStateCode = 'CA' | 'FL' | 'GA' | 'TX';

export default class UserProfilePage {
  constructor(private page: Page) {}

  async startFreshLoggedOutSession() {
    await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await this.logoutIfAuthenticated();

    await this.page.context().clearCookies();
    await this.gotoHomeForSessionReset();
    await this.page
      .evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      })
      .catch(() => undefined);
    await this.gotoHomeForSessionReset();
  }

  private async gotoHomeForSessionReset() {
    try {
      await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const knownProductionLoginRedirect =
        /navigation to "https:\/\/(?:www\.)?the platform\.com\/" is interrupted by another navigation to "https:\/\/(?:www\.)?the platform\.com\/login"/i.test(
          message,
        );

      if (!message.includes('net::ERR_ABORTED') && !knownProductionLoginRedirect) {
        throw error;
      }

      await this.page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined);
    }
  }

  async expectDashboardReady() {
    await this.page.waitForURL((url) => url.pathname.startsWith('/dashboard'), {
      timeout: 30000,
    });
    await expect(
      this.profileMenuButton(),
      'Expected logged-in profile menu after login.',
    ).toBeVisible({ timeout: 30000 });
    await expect
      .poll(
        async () =>
          (
            await this.profileMenuButton()
              .innerText()
              .catch(() => '')
          )
            .replace(/\s+/g, ' ')
            .trim(),
        { message: 'Expected real profile menu text, not logged-out placeholder.' },
      )
      .not.toMatch(/^(YN|Your Name)$/i);
  }

  async expectProfileActiveState(expectedStateCode: SupportedProfileStateCode) {
    const menu = await this.openProfileMenu();
    const activeStateCode = this.parseActiveStateCode(await menu.innerText({ timeout: 15000 }));

    expect(
      activeStateCode,
      `Expected ${this.stateLabel(
        expectedStateCode,
      )} active-state user, but profile showed active state "${activeStateCode ?? 'unknown'}".`,
    ).toBe(expectedStateCode);
  }

  async openManageProfileFromProfileMenu() {
    let menu = this.profileMenu();

    if (!(await menu.isVisible({ timeout: 3000 }).catch(() => false))) {
      menu = await this.openProfileMenu();
    }

    const manageProfile = menu
      .getByRole('menuitem', { name: /manage profile/i })
      .or(menu.getByRole('link', { name: /manage profile/i }))
      .or(menu.getByRole('button', { name: /manage profile/i }))
      .or(menu.locator('button, a, [role="menuitem"]').filter({ hasText: /manage profile/i }))
      .first();

    await expect(manageProfile, 'Expected Manage Profile action in profile menu.').toBeVisible({
      timeout: 20000,
    });
    await manageProfile.click();

    await this.page.waitForURL((url) => url.pathname.startsWith('/dashboard/profile'), {
      timeout: 30000,
    });
    await expect(
      this.buyerAgreementSectionEntry(),
      'Expected Manage Profile page or section to open.',
    ).toBeVisible({ timeout: 30000 });
  }

  async openBuyerAgreementSection() {
    const buyerAgreementEntry = this.buyerAgreementSectionEntry();
    const buyerAgreementHref = await buyerAgreementEntry.getAttribute('href').catch(() => null);

    await expect(
      buyerAgreementEntry,
      'Expected Buyer Agreement section in Manage Profile.',
    ).toBeVisible({ timeout: 30000 });
    await buyerAgreementEntry.click();

    const reachedBuyerAgreementPage = await this.page
      .waitForURL((url) => url.pathname.startsWith('/dashboard/profile/buyer-agreement'), {
        timeout: 15000,
      })
      .then(() => true)
      .catch(() => false);

    if (!reachedBuyerAgreementPage && buyerAgreementHref) {
      await this.page.goto(buyerAgreementHref, { waitUntil: 'domcontentloaded' });
    }

    await expect(this.page, 'Expected Buyer Agreement page or section to open.').toHaveURL(
      /\/dashboard\/profile\/buyer-agreement/,
    );
    await expect(
      this.page.locator('body'),
      'Expected Buyer Agreement page or section content to load.',
    ).toContainText(/buyer agreement|the listing provider by the platform|licensed real estate expert/i, {
      timeout: 30000,
    });
  }

  private async logoutIfAuthenticated() {
    const profileButton = this.profileMenuButton();

    if (!(await profileButton.isVisible({ timeout: 5000 }).catch(() => false))) {
      return;
    }

    await profileButton.click();

    const menu = this.profileMenu();
    const logoutAction = menu
      .getByRole('menuitem', { name: /log out|logout|sign out/i })
      .or(menu.getByRole('button', { name: /log out|logout|sign out/i }))
      .or(menu.getByRole('link', { name: /log out|logout|sign out/i }))
      .or(
        menu
          .locator('button, a, [role="menuitem"]')
          .filter({ hasText: /log out|logout|sign out/i }),
      )
      .first();

    if (await logoutAction.isVisible({ timeout: 5000 }).catch(() => false)) {
      await logoutAction.click();
      await this.page
        .waitForURL(
          (url) => /\/(?:login|register)(?:\/|$)/.test(url.pathname) || url.pathname === '/',
          {
            timeout: 15000,
          },
        )
        .catch(() => undefined);
      return;
    }

    await this.page.keyboard.press('Escape').catch(() => undefined);
  }

  private async openProfileMenu() {
    const profileButton = this.profileMenuButton();

    await expect(profileButton, 'Expected profile menu button in side navigation.').toBeVisible({
      timeout: 30000,
    });
    await profileButton.click();

    const menu = this.profileMenu();

    await expect(
      menu,
      'Expected profile menu popup with profile options and active state.',
    ).toBeVisible({ timeout: 20000 });

    return menu;
  }

  private buyerAgreementSectionEntry() {
    return this.page
      .getByRole('link', { name: /buyer agreement/i })
      .or(this.page.getByRole('button', { name: /buyer agreement/i }))
      .or(this.page.getByRole('tab', { name: /buyer agreement/i }))
      .or(
        this.page
          .locator('a, button, [role="button"], [role="tab"]')
          .filter({ hasText: /buyer agreement/i }),
      )
      .first();
  }

  private profileMenuButton() {
    return this.page.getByRole('button', { name: /profile menu/i }).first();
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

  private parseActiveStateCode(profileText: string): SupportedProfileStateCode | undefined {
    const lines = profileText
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const statePattern = /\b(California|CA|Florida|FL|Georgia|GA|Texas|TX)\b/i;

    for (let index = 0; index < lines.length; index += 1) {
      if (!/active state|service state|buying state|state/i.test(lines[index]!)) {
        continue;
      }

      const nearbyText = lines.slice(index, index + 4).join(' ');
      const match = nearbyText.match(statePattern);

      if (match) {
        return this.toProfileStateCode(match[1]!);
      }
    }

    const fullTextMatch = profileText.match(
      /(?:active state|service state|buying state|state)\s*:?\s*(California|CA|Florida|FL|Georgia|GA|Texas|TX)\b/i,
    );

    if (fullTextMatch) {
      return this.toProfileStateCode(fullTextMatch[1]!);
    }

    const visibleStatePattern = /\b(California|CA|Florida|FL|Georgia|GA|Texas|TX)\b/gi;
    const visibleStateCodes = [...profileText.matchAll(visibleStatePattern)].map((match) =>
      this.toProfileStateCode(match[1]!),
    );
    const uniqueVisibleStateCodes = new Set(visibleStateCodes);

    if (uniqueVisibleStateCodes.size === 1) {
      return [...uniqueVisibleStateCodes][0];
    }

    return undefined;
  }

  private toProfileStateCode(value: string): SupportedProfileStateCode {
    if (/^(ca|california)$/i.test(value)) {
      return 'CA';
    }

    if (/^(fl|florida)$/i.test(value)) {
      return 'FL';
    }

    if (/^(ga|georgia)$/i.test(value)) {
      return 'GA';
    }

    return 'TX';
  }

  private stateLabel(stateCode: SupportedProfileStateCode) {
    const labels: Record<SupportedProfileStateCode, string> = {
      CA: 'California',
      FL: 'Florida',
      GA: 'Georgia',
      TX: 'Texas',
    };

    return labels[stateCode];
  }
}
