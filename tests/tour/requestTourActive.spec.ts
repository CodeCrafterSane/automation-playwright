import { test } from '../../fixtures/auth.fixture';
import SearchPage, { PropertyIdentifier } from '../../pages/search/SearchPage';
import RequestTourPage, {
  ActiveTourState,
  BuyerAgreementOutcome,
} from '../../pages/tour/RequestTourPage';

const MIN_PROPERTY_CARDS = 1;

async function readSupportedActiveState(requestTourPage: RequestTourPage): Promise<
  ActiveTourState & { code: 'FL' | 'GA' }
> {
  await requestTourPage.ensureLoggedInDashboard('BUYER');
  let activeState = await requestTourPage.readActiveStateFromProfile();
  console.info(`[request-tour] Profile active state: ${activeState.code ?? activeState.label}`);

  if (!requestTourPage.isTourSupportedActiveState(activeState)) {
    await requestTourPage.ensureLoggedInDashboard('BUYER');
    activeState = await requestTourPage.readActiveStateFromProfile();
    console.info(
      `[request-tour] Profile active state after retry: ${activeState.code ?? activeState.label}`,
    );
  }

  if (!requestTourPage.isTourSupportedActiveState(activeState)) {
    throw new Error(
      `Profile active state is "${activeState.label}", so FL/GA tour booking cannot be requested.`,
    );
  }

  return activeState;
}

test.describe('Request a Tour Active @P1', () => {
  test.use({ role: 'BUYER', credentialKey: 'ACTIVE_STATE', reuseSession: false });

  test('authenticated verified user can validate and start an active-state request tour flow', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300000);

    const searchPage = new SearchPage(page);
    const requestTourPage = new RequestTourPage(page);
    const activeState = await readSupportedActiveState(requestTourPage);

    let dashboardPropertyIdentifier: PropertyIdentifier | undefined;
    let searchPropertyIdentifier: PropertyIdentifier | undefined;
    const buyerAgreementOutcomes: BuyerAgreementOutcome[] = [];

    const handlePostRequestState = async (source: string) => {
      await requestTourPage.handlePhoneNumberIfRequested();

      const buyerAgreementOutcome = await requestTourPage.validateBuyerAgreementAndExit();
      const tourRequestConfirmed = await requestTourPage.closeTourConfirmationIfVisible();

      if (!tourRequestConfirmed) {
        testInfo.annotations.push({
          type: 'upcoming-tour',
          description: `${source} did not show a tour confirmation dialog, so the requested tour is verified directly from the dashboard Tours section.`,
        });
      }

      buyerAgreementOutcomes.push(buyerAgreementOutcome);
    };

    await test.step('TC_005: start tour request from active-state dashboard listings', async () => {
      await requestTourPage.ensureLoggedInDashboard('BUYER');

      const dashboardTourCandidate = await requestTourPage.findDashboardTourCandidate();
      if (!dashboardTourCandidate) {
        throw new Error(
          'Expected at least one dashboard listing with an enabled Request a tour CTA after scanning the horizontal listings carousel.',
        );
      }

      dashboardPropertyIdentifier =
        await requestTourPage.getDashboardPropertyIdentifier(dashboardTourCandidate.propertyCard);

      await requestTourPage.clickDashboardRequestTourCandidate(dashboardTourCandidate);
      await requestTourPage.expectTimeSlotModalVisible();
      await requestTourPage.validateSingleDateAndTimeSelection();
      await requestTourPage.validateUnavailableTimeSlotsStayDisabled();
      await requestTourPage.validateCanChangeDateAndTimeBeforeContinue();
      await requestTourPage.continueFromTimeSlotModal();
      await handlePostRequestState('Dashboard listings request');
    });

    if (!dashboardPropertyIdentifier) {
      throw new Error('Dashboard-requested property identifier was not captured.');
    }

    const dashboardTourPropertyIdentifier = dashboardPropertyIdentifier;

    await test.step('TC_006: request a tour from active-state search results', async () => {
      const activeResults = await searchPage.prepareSearchWithTourRequestablePropertyAcrossLocations(
        searchPage.getTourLocationsForState(activeState.code),
        MIN_PROPERTY_CARDS,
      );
      const activePropertyCard = activeResults.propertyCard;

      searchPropertyIdentifier = await searchPage.getPropertyIdentifier(activePropertyCard);

      await searchPage.clickRequestTourForProperty(activePropertyCard);
      await requestTourPage.expectTimeSlotModalVisible();
      await requestTourPage.selectEligibleDateAndTime();
      await requestTourPage.continueFromTimeSlotModal();
      await handlePostRequestState('Search results request');
    });

    if (!searchPropertyIdentifier) {
      throw new Error('Search-requested property identifier was not captured.');
    }

    const searchTourPropertyIdentifier = searchPropertyIdentifier;

    await test.step('TC_015: dashboard and search requested tours appear in Tours from the Hub', async () => {
      for (const propertyIdentifier of [dashboardTourPropertyIdentifier, searchTourPropertyIdentifier]) {
        await requestTourPage.assertRequestedTourVisibleFromHubTours(propertyIdentifier);
      }
    });

    testInfo.annotations.push({
      type: 'buyer-agreement',
      description: buyerAgreementOutcomes.includes('agreement-required-exited')
        ? 'Buyer agreement was shown, validated, and exited without signing.'
        : 'Buyer agreement was not shown, likely because the account has already signed it.',
    });
  });
});
