import { expect, Page } from '@playwright/test';

export type MortgageControl = {
  text: string;
  href: string;
};

export type MortgageHrefTiming = {
  hrefChangeMs?: number;
  mortgageFormSeenAt?: number;
};

export default class MortgagePage {
  constructor(private page: Page) {}

  async openFromBaseHeader() {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });

    const mortgageControl = this.page
      .getByRole('link', { name: /^mortgage$/i })
      .or(this.page.getByRole('button', { name: /^mortgage$/i }))
      .first();

    await expect(mortgageControl, 'Expected Mortgage control in the base header.').toBeVisible({
      timeout: 30000,
    });
    await mortgageControl.click();

    await expect(this.page, 'Expected Mortgage navigation to open the mortgage page.').toHaveURL(
      /\/mortgage(?:\/|\?|$)/,
    );
  }

  async openFirstVaLoanQualifyForm() {
    const qualifyLinks = this.page.getByRole('link', { name: /^check if you qualify$/i });
    const qualifyLink = qualifyLinks.first();

    await expect(qualifyLink, 'Expected first Check if you qualify CTA to be visible.').toBeVisible({
      timeout: 30000,
    });
    await expect(qualifyLink, 'Expected first Check if you qualify CTA to be enabled.').toBeEnabled();
    // VA loan spec only: let the first CTA href settle before clicking.
    await this.page.waitForTimeout(1000);
    const href = await qualifyLink.getAttribute('href');

    console.log(`[Mortgage] clicking first Check if you qualify: ${href || '(no href found)'}`);

    await qualifyLink.click();

    await expect(this.page, 'Expected Check if you qualify CTA to open the VA loan form.').toHaveURL(
      /\/mortgage\/form\/va-loan-1(?:\/|\?|$)/,
    );
  }

  async collectControlsFor(durationMs = 5_000, intervalMs = 20) {
    let latestControls: MortgageControl[] = [];
    const startedAt = Date.now();
    let attempts = 0;

    while (Date.now() - startedAt < durationMs) {
      attempts += 1;
      latestControls = await this.collectMortgageControls();
      await this.page.waitForTimeout(intervalMs);
    }

    return { attempts, controls: latestControls };
  }

  expectMortgageNavigationHrefs(controls: MortgageControl[]) {
    expect(
      controls
        .map(({ href }) => href)
        .filter((href) => this.isMortgageNavigationHref(href) && !this.startsWithMortgagePath(href)),
      'Expected every captured mortgage href to keep /mortgage in the path.',
    ).toEqual([]);
  }

  printMortgageControls(controls: MortgageControl[]) {
    const hrefCounts = new Map<string, number>();
    const mortgageControls = controls.filter(({ href }) => this.startsWithMortgagePath(href));
    const otherControls = controls.filter(({ href }) => !this.startsWithMortgagePath(href));

    this.printMortgageControlGroup('starts with /mortgage', mortgageControls, hrefCounts);
    this.printMortgageControlGroup('does not start with /mortgage', otherControls, hrefCounts);
  }

  async measureQualifyHrefTiming(windowMs = 10_000, intervalMs = 20): Promise<MortgageHrefTiming> {
    const startedAt = Date.now();
    let shortFormSeenAt: number | undefined;
    let mortgageFormSeenAt: number | undefined;

    while (Date.now() - startedAt < windowMs) {
      const hrefs = await this.collectQualifyFormHrefs();
      const elapsedMs = Date.now() - startedAt;

      if (shortFormSeenAt === undefined && hrefs.some((href) => this.hrefPathname(href) === '/form/va-loan-1')) {
        shortFormSeenAt = elapsedMs;
      }

      if (
        mortgageFormSeenAt === undefined &&
        hrefs.some((href) => this.hrefPathname(href) === '/mortgage/form/va-loan-1')
      ) {
        mortgageFormSeenAt = elapsedMs;
      }

      if (shortFormSeenAt !== undefined && mortgageFormSeenAt !== undefined) {
        break;
      }

      await this.page.waitForTimeout(intervalMs);
    }

    return {
      mortgageFormSeenAt,
      hrefChangeMs:
        shortFormSeenAt === undefined && mortgageFormSeenAt !== undefined
          ? 0
          : shortFormSeenAt !== undefined && mortgageFormSeenAt !== undefined
            ? mortgageFormSeenAt - shortFormSeenAt
            : undefined,
    };
  }

  private async collectMortgageControls() {
    return this.page.locator('a, button').evaluateAll((controls) =>
      controls
        .map((control) => {
          const text =
            (control as HTMLElement).innerText?.replace(/\s+/g, ' ').trim() ||
            control.getAttribute('aria-label')?.replace(/\s+/g, ' ').trim() ||
            control.textContent?.replace(/\s+/g, ' ').trim() ||
            '';
          const link = control.closest('a');

          return {
            text,
            href: link?.href ?? '',
          };
        })
        .filter(({ text, href }) => text.length > 0 || href.length > 0),
    );
  }

  private async collectQualifyFormHrefs() {
    return this.page.locator('a[href], button').evaluateAll((controls) =>
      controls
        .map((control) => control.closest('a')?.href ?? '')
        .filter((href) => /\/(?:mortgage\/)?form\/va-loan-1(?:[/?#]|$)/.test(href)),
    );
  }

  private printMortgageControlGroup(
    label: string,
    controls: MortgageControl[],
    hrefCounts: Map<string, number>,
  ) {
    console.log(`[Mortgage] ${label}: ${controls.length}`);

    for (const { href } of controls) {
      const occurrence = href ? (hrefCounts.get(href) ?? 0) + 1 : 0;

      if (href) {
        hrefCounts.set(href, occurrence);
      }

      console.log(
        `[Mortgage] ${href || '(no href found)'}${occurrence > 1 ? ` duplicate #${occurrence}` : ''}`,
      );
    }
  }

  private startsWithMortgagePath(href: string) {
    if (!href) {
      return false;
    }

    try {
      return new URL(href).pathname.startsWith('/mortgage');
    } catch {
      return href.startsWith('/mortgage');
    }
  }

  private isMortgageNavigationHref(href: string) {
    if (!href) {
      return false;
    }

    try {
      const url = new URL(href);
      const path = url.pathname;

      return (
        url.hostname.endsWith('the platform.com') &&
        (/loan|mortgage|refinance|calculator|vetted-va|form|licensing|team|contact-us|hiring|careers|privacy-policy/.test(
          path,
        ) ||
          path === '/mortgage' ||
          path === '/mortgage/')
      );
    } catch {
      return /loan|mortgage|refinance|calculator|vetted-va|form|licensing|team|contact-us|hiring|careers|privacy-policy/.test(
        href,
      );
    }
  }

  private hrefPathname(href: string) {
    try {
      return new URL(href).pathname;
    } catch {
      return href.split(/[?#]/)[0] ?? '';
    }
  }
}
