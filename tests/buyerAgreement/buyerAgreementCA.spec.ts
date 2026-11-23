import { test } from '../../fixtures/base.fixture';
import BuyerAgreementPage from '../../pages/buyer-agreement/BuyerAgreementPage';
import UserProfilePage from '../../pages/profile/UserProfilePage';
import { PREFIX } from '../../utils/env';

test.describe('Buyer Agreement California restriction @P2', () => {
  test('California active-state user cannot sign buyer agreement directly', async ({ page }) => {
    test.setTimeout(120000);

    const buyerAgreementPage = new BuyerAgreementPage(page);
    const userProfilePage = new UserProfilePage(page);
    const { email, password } = getCaBuyerCredentials();

    await test.step('Authenticate the dedicated California buyer', async () => {
      await test.step('Clear browser state and start from a logged-out session', async () => {
        await userProfilePage.startFreshLoggedOutSession();
      });

      await test.step('Submit the California buyer email and password', async () => {
        await buyerAgreementPage.loginWithDedicatedBuyer(email, password);
      });

      await test.step('Assert the authenticated dashboard is ready', async () => {
        await userProfilePage.expectDashboardReady();
      });
    });

    await test.step('Confirm the account is configured for California', async () => {
      await userProfilePage.expectProfileActiveState('CA');
    });

    await test.step('Open Buyer Agreement from Manage Profile', async () => {
      await test.step('Navigate from the profile menu to Manage Profile', async () => {
        await userProfilePage.openManageProfileFromProfileMenu();
      });

      await test.step('Open the Buyer Agreement profile section', async () => {
        await userProfilePage.openBuyerAgreementSection();
      });
    });

    await test.step('Assert California buyers cannot start direct agreement signing', async () => {
      await buyerAgreementPage.expectCaliforniaRestriction();
    });
  });
});

function getCaBuyerCredentials() {
  const email = process.env[`${PREFIX}_CA_BUYER_EMAIL`];
  const password = process.env[`${PREFIX}_CA_BUYER_PASSWORD`];

  if (!email || !password) {
    throw new Error(
      `Missing California buyer credentials. Expected ${PREFIX}_CA_BUYER_EMAIL and ${PREFIX}_CA_BUYER_PASSWORD.`,
    );
  }

  return { email, password };
}
