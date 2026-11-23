import { test } from '../../fixtures/auth.fixture';
import SearchPage, { PropertyIdentifier } from '../../pages/search/SearchPage';
import RequestTourPage, {
  ActiveTourState,
  BuyerAgreementOutcome,
} from '../../pages/tour/RequestTourPage';

const MIN_PROPERTY_CARDS = 1;
const MAX_LISTING_CANDIDATES = 4;

async function readSupportedActiveState(requestTourPage: RequestTourPage): Promise<
  ActiveTourState & { code: 'FL' | 'GA' }
> {
  await requestTourPage.ensureLoggedInDashboard('BUYER');
  let activeState = await requestTourPage.readActiveStateFromProfile();
  console.info(`[request-tour-listing] Profile active state: ${activeState.code ?? activeState.label}`);

  if (!requestTourPage.isTourSupportedActiveState(activeState)) {
    await requestTourPage.ensureLoggedInDashboard('BUYER');
    activeState = await requestTourPage.readActiveStateFromProfile();
    console.info(
      `[request-tour-listing] Profile active state after retry: ${activeState.code ?? activeState.label}`,
    );
  }

  if (!requestTourPage.isTourSupportedActiveState(activeState)) {
    throw new Error(
      `Profile active state is "${activeState.label}", so FL/GA tour booking cannot be requested.`,
    );
  }

  return activeState;
}

test.describe('Request a Tour Listing Page @P1', () => {
  test.use({ role: 'BUYER', credentialKey: 'ACTIVE_STATE', reuseSession: false });

  test('authenticated verified user can request a tour from an active-state property listing page', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(300000);

    const searchPage = new SearchPage(page);
    const requestTourPage = new RequestTourPage(page);
    const activeState = await readSupportedActiveState(requestTourPage);
    const buyerAgreementOutcomes: BuyerAgreementOutcome[] = [];
    let listingPropertyIdentifier: PropertyIdentifier | undefined;

    await test.step('Open an active-state property listing with an enabled Request a tour CTA', async () => {
      const attempts: string[] = [];

      for (let attempt = 0; attempt < MAX_LISTING_CANDIDATES; attempt += 1) {
        const activeResults = await searchPage.prepareSearchWithTourRequestablePropertyAcrossLocations(
          searchPage.getTourLocationsForState(activeState.code),
          MIN_PROPERTY_CARDS,
        );
        const listingPropertyCard = activeResults.propertyCard;
        const candidateIdentifier = await searchPage.getPropertyIdentifier(listingPropertyCard);

        await searchPage.openListingForProperty(listingPropertyCard, candidateIdentifier);

        if (await searchPage.canRequestTourOnListingPage()) {
          listingPropertyIdentifier = candidateIdentifier;
          return;
        }

        attempts.push(candidateIdentifier.titleOrAddress);
      }

      throw new Error(
        `No active-state property listing page had an enabled Request a tour CTA. Tried: ${attempts.join('; ')}`,
      );
    });

    if (!listingPropertyIdentifier) {
      throw new Error('Listing-page-requested property identifier was not captured.');
    }

    const requestedListingPropertyIdentifier = listingPropertyIdentifier;

    await test.step('Request the tour from the property listing page', async () => {
      await searchPage.clickRequestTourOnListingPage();
      await requestTourPage.expectTimeSlotModalVisible();
      await requestTourPage.selectEligibleDateAndTime();
      await requestTourPage.continueFromTimeSlotModal();
      await requestTourPage.handlePhoneNumberIfRequested();

      const buyerAgreementOutcome = await requestTourPage.validateBuyerAgreementAndExit();
      const tourRequestConfirmed = await requestTourPage.closeTourConfirmationIfVisible();

      if (!tourRequestConfirmed) {
        testInfo.annotations.push({
          type: 'upcoming-tour',
          description:
            'Property listing page request did not show a tour confirmation dialog, so the requested tour is verified directly from the dashboard Tours section.',
        });
      }

      buyerAgreementOutcomes.push(buyerAgreementOutcome);
      await searchPage.expectListingTourRequestStarted();
    });

    await test.step('Listing-page requested tour appears in Tours from the Hub', async () => {
      await requestTourPage.assertRequestedTourVisibleFromHubTours(requestedListingPropertyIdentifier);
    });

    testInfo.annotations.push({
      type: 'buyer-agreement',
      description: buyerAgreementOutcomes.includes('agreement-required-exited')
        ? 'Buyer agreement was shown, validated, and exited without signing.'
        : 'Buyer agreement was not shown, likely because the account has already signed it.',
    });
  });
});
