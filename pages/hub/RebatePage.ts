import { contracts } from '../../config/contracts';
import { test, expect, Page } from '@playwright/test';

const BELOW_500K_REBATE_MESSAGE = 'You may be eligible for rebate!';
const HOME_PRICE_ERROR_MESSAGE = 'Please enter home price between $200,000 and $10M';

export default class RebatePage {
  constructor(private page: Page) {}

  async openEstimatedRebateModal() {
    await test.step('Open Estimated Rebate modal', async () => {
      const candidates = [
        this.page.getByRole('button', { name: 'Estimated Rebate' }),
        this.page.getByRole('button', { name: 'Estimate your savings' }),
        this.page.getByRole('button', { name: 'Estimate your rebate' }),
        this.page.getByText('Estimated Rebate'),
      ];

      if (this.page.isClosed()) {
        throw new Error('Page is already closed before opening Estimated Rebate modal');
      }

      for (const locator of candidates) {
        if (await locator.isVisible({ timeout: 1500 }).catch(() => false)) {
          await locator.click();
          return;
        }
      }

      try {
        await this.page.screenshot({ path: test.info().outputPath('estimated-rebate-open-error.png'), fullPage: true });
      } catch {}

      throw new Error('Estimated Rebate button not found (tried multiple selectors)');
    });
  }

  async verifyRebateBreakdownInteractive(homePrice: number): Promise<string> {
    const formattedSavings = this.formatNumberWithCommas(this.calculateSavingsAmount(homePrice));

    const realtyRebate = homePrice * 0.01;
    const mortgageRebate = homePrice * 0.005;
    const totalCashBack = realtyRebate + mortgageRebate;

    const formattedPrice = `$${this.formatNumberWithCommas(homePrice)}`;
    const formattedRealty = `$${this.formatCurrency(realtyRebate)}`;
    const formattedMortgage = `$${this.formatCurrency(mortgageRebate)}`;
    const formattedTotal = `$${this.formatCurrency(totalCashBack)}`;

    const modal = this.rebateDialog();

    await this.openEstimatedRebateModal();

    const homePriceLine = modal.getByText('Home price', { exact: true }).locator('..');
    await test.step(`Verify Home price = ${formattedPrice}`, async () => {
      await expect(homePriceLine).toContainText(formattedPrice);
    });

    const realtyLine = modal.getByText('Realty service rebate(1%)$').locator('..');
    await test.step(`Verify Realty service rebate = ${formattedRealty}`, async () => {
      await expect(realtyLine).toContainText(formattedRealty);
    });

    const mortgageLine = modal.getByText('Mortgage service rebate (0.5%)$').locator('..');
    await test.step(`Verify Mortgage service rebate = ${formattedMortgage}`, async () => {
      await expect(mortgageLine).toContainText(formattedMortgage);
    });

    const cashBackLine = modal.getByText('Cash back at closing', { exact: true }).locator('..');
    await test.step(`Verify Cash back at closing = ${formattedTotal.split('.')[0]}`, async () => {
      await expect(cashBackLine).toContainText(formattedTotal.split('.')[0]);
    });

    return formattedSavings;
  }

  async verifySavingsAmount(formattedSavings: string) {
    await test.step(`Verify savings amount message = $${formattedSavings}`, async () => {
      await expect(this.page.getByRole('main')).toContainText(
        'Buying with the platform could save you up',
      );
      await expect(this.page.getByRole('main')).toContainText(`$${formattedSavings}`);
      await expect(this.page.getByRole('main')).toContainText('at closing.');
    });
  }

  async verifyRebateRangeError() {
    const errorLocator = this.page.locator('[data-slot="form-message"]');

    await test.step('Verify rebate range error is visible', async () => {
      await expect(errorLocator).toBeVisible();
    });

    await test.step(`Verify rebate range error text = ${HOME_PRICE_ERROR_MESSAGE}`, async () => {
      await expect(errorLocator).toHaveText(HOME_PRICE_ERROR_MESSAGE);
    });
  }

  async verifyEligibilityMessage() {
    await test.step(`Verify eligibility message = ${BELOW_500K_REBATE_MESSAGE}`, async () => {
      await expect(this.page.getByRole('main')).toContainText(BELOW_500K_REBATE_MESSAGE);
    });
  }

  async verifyRebateAmountUpdatedToastVisible() {
    await test.step('Verify Rebate amount updated successfully toast is visible', async () => {
      // Product copy: toast.success("Rebate amount updated successfully") in estimate-rebate-modal.tsx
      await expect(
        this.page
          .locator('[data-sonner-toast]')
          .filter({ hasText: 'Rebate amount updated successfully' })
          .first(),
      ).toBeVisible({ timeout: 15000 });
    });
  }

  async verifySavingsMessage(homePrice: number) {
    const formattedSavings = this.formatNumberWithCommas(this.calculateSavingsAmount(homePrice));

    await test.step(`Verify savings message for $${this.formatNumberWithCommas(homePrice)} = $${formattedSavings}`, async () => {
      await expect(this.page.getByRole('main')).toContainText(
        'Buying with the platform could save you up',
      );
      await expect(this.page.getByRole('main')).toContainText(`$${formattedSavings}`);
      await expect(this.page.getByRole('main')).toContainText('at closing.');
    });
  }

  async isHomePriceEditorOpen() {
    const homePriceInput = this.homePriceInput();

    try {
      return await homePriceInput.isVisible();
    } catch {
      return false;
    }
  }

  async openEditPriceModal() {
    await this.openHomePriceEditor();
  }

  async openHomePriceEditor() {
    if (await this.isHomePriceEditorOpen()) {
      return;
    }

    const editButton = this.page.getByRole('button', { name: 'Edit' }).first();
    const estimateSavingsButton = this.page
      .getByRole('button', { name: 'Estimate your savings' })
      .first();
    const editorButton = editButton.or(estimateSavingsButton).first();

    await test.step('Verify home price editor button is visible', async () => {
      await expect(editorButton).toBeVisible();
    });

    await test.step('Open home price editor', async () => {
      await editorButton.click();
    });

    await test.step('Verify home price input is visible', async () => {
      await expect(this.homePriceInput()).toBeVisible();
    });
  }

  async editHomePrice(homePrice: number) {
    const homePriceInput = this.homePriceInput();
    const formattedHomePrice = this.formatNumberWithCommas(homePrice);

    await test.step(`Fill home price = $${formattedHomePrice}`, async () => {
      await homePriceInput.fill(homePrice.toString());
    });

    await test.step(`Verify home price input value = $${formattedHomePrice}`, async () => {
      await expect(homePriceInput).toHaveValue(formattedHomePrice);
    });
  }

  async saveHomePrice(options: { expectSuccess?: boolean } = {}) {
    const { expectSuccess = false } = options;
    const buyerProfilePostTimeoutMs = 30_000;

    if (expectSuccess) {
      await test.step('Save home price and wait for buyer_profile POST', async () => {
        const rebateDialog = this.rebateDialog();
        await expect(rebateDialog).toBeVisible({ timeout: 15_000 });

        const buyerProfilePostDeadline = Date.now() + buyerProfilePostTimeoutMs;
        const buyerProfilePost = this.page.waitForResponse(
          (response) =>
            new URL(response.url()).pathname === contracts.buyerProfile &&
            response.request().method().toUpperCase() === 'POST',
          { timeout: buyerProfilePostTimeoutMs },
        );

        await this.page.getByRole('button', { name: 'Save' }).click();

        let response;
        try {
          response = await buyerProfilePost;
        } catch (error) {
          if (error instanceof Error && error.name === 'TimeoutError') {
            throw new Error(
              `buyer_profile POST did not complete within ${buyerProfilePostTimeoutMs / 1000}s (stage: no-response)`,
            );
          }
          throw error;
        }

        const bodyFinishBudgetMs = buyerProfilePostDeadline - Date.now();
        if (bodyFinishBudgetMs <= 0) {
          throw new Error(
            `buyer_profile POST did not complete within ${buyerProfilePostTimeoutMs / 1000}s (stage: body-never-finished)`,
          );
        }

        let bodyFinishTimeout: ReturnType<typeof setTimeout> | undefined;
        const bodyFinishResult = await Promise.race([
          response.finished(),
          new Promise<never>((_, reject) => {
            bodyFinishTimeout = setTimeout(
              () =>
                reject(
                  new Error(
                    `buyer_profile POST did not complete within ${buyerProfilePostTimeoutMs / 1000}s (stage: body-never-finished)`,
                  ),
                ),
              bodyFinishBudgetMs,
            );
          }),
        ]).finally(() => {
          if (bodyFinishTimeout) {
            clearTimeout(bodyFinishTimeout);
          }
        });

        if (bodyFinishResult instanceof Error) {
          throw bodyFinishResult;
        }

        if (response.status() < 200 || response.status() >= 300) {
          throw new Error(
            `buyer_profile POST failed with status ${response.status()} for ${response.url()}`,
          );
        }

        await this.verifyRebateAmountUpdatedToastVisible();
        await expect(rebateDialog).toBeHidden({ timeout: 15_000 });
      });
      return;
    }

    await test.step('Click Save home price', async () => {
      await this.page.getByRole('button', { name: 'Save' }).click();
    });

    await test.step('Verify home price input is visible after save', async () => {
      await expect(this.homePriceInput()).toBeVisible({ timeout: 20000 });
    });
  }

  async updateHomePrice(homePrice: number) {
    await this.openEditPriceModal();
    await this.editHomePrice(homePrice);
    await this.saveHomePrice();
  }

  private homePriceInput() {
    return this.page.getByRole('textbox', { name: 'What is your target home' });
  }

  private rebateDialog() {
    return this.page.getByRole('dialog', { name: 'Estimate Rebate', exact: true });
  }

  private formatNumberWithCommas(value: number): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 0,
    });
  }

  private formatCurrency(value: number): string {
    return value.toLocaleString('en-US', {
      maximumFractionDigits: 2,
    });
  }

  private calculateSavingsAmount(homePrice: number) {
    return Math.round(homePrice * 0.015);
  }
}
