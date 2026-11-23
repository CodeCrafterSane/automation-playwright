import { test } from '../../fixtures/base.fixture';
import MortgagePage from '../../pages/mortgage/MortgagePage';
import VaLoanFormPage from '../../pages/mortgage/VaLoanFormPage';

test.describe('Mortgage Qualify VA Loan @P1', () => {
  test('opens the first qualify CTA and fills the VA loan form with random inputs', async ({ page }) => {
    const mortgagePage = new MortgagePage(page);
    const vaLoanFormPage = new VaLoanFormPage(page);

    await test.step('Open mortgage page from base header', async () => {
      await mortgagePage.openFromBaseHeader();
    });

    await test.step('Open first VA loan qualify form', async () => {
      await mortgagePage.openFirstVaLoanQualifyForm();
    });

    await test.step('Complete VA loan form with random inputs', async () => {
      await vaLoanFormPage.completeWithRandomInputs();
    });
  });
});
