import { test } from '../../fixtures/base.fixture';
import LoginPage from '../../pages/auth/LoginPage';
import OnboardingPage from '../../pages/auth/OnboardingPage';
import { PREFIX } from '../../utils/env';

const LOCATION_VALIDATION_COUNT = 2;

async function getFreshOnboardingCredentials() {
  const baseEmail = process.env[`${PREFIX}_ONBOARDING_EMAIL`];
  const password = process.env[`${PREFIX}_ONBOARDING_PASSWORD`];

  if (!baseEmail || !password) {
    throw new Error(
      `Missing onboarding credentials. Expected: ${PREFIX}_ONBOARDING_EMAIL and ${PREFIX}_ONBOARDING_PASSWORD`,
    );
  }

  return {
    email: baseEmail,
    password,
  };
}

test.describe('Onboarding already signed up users @P2', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    testInfo.setTimeout(120000);

    const { email, password } = await getFreshOnboardingCredentials();

    await test.step(`Authenticate the dedicated onboarding account`, async () => {
      await new LoginPage(page).fullLogin(email, password);
    });
  });

  test(`should validate availability for ${LOCATION_VALIDATION_COUNT} random locations and complete onboarding`, async ({
    page,
  }) => {
    const onboardingPage = new OnboardingPage(page);

    let initialCashback = '';
    let updatedCashback = '';

    const locationsToValidate =
      onboardingPage.getRandomLocationsToValidate(LOCATION_VALIDATION_COUNT);

    const finalLocation = onboardingPage.getRandomRealtyAvailableLocation();
    const shouldValidateCashback = finalLocation.availability === 'REALTY_AVAILABLE';

    const randomSelections = {
      requestedLocationValidationCount: LOCATION_VALIDATION_COUNT,
      actualLocationValidationCount: locationsToValidate.length,
      validatedLocations: locationsToValidate.map((location) => ({
        location: location.shortName,
        state: location.state,
        availability: location.availability,
      })),
      finalLocation: finalLocation.shortName,
      finalAvailability: finalLocation.availability,
      homePrice: '',
      updatedHomePrice: '',
      mortgagePreApproval: '',
      propertyType: '',
      bedrooms: '',
      bathrooms: '',
      initialCashback: '',
      updatedCashback: '',
      finalCashback: '',
    };

    await test.step('Open logged-in onboarding location step', async () => {
      await onboardingPage.gotoLoggedIn();
      await onboardingPage.expectLoggedInLocationStepVisible();
    });

    await test.step('Validate required location error', async () => {
      await onboardingPage.continueWithoutValidLocation();
      await onboardingPage.expectValidLocationRequiredMessage();
    });

    await test.step(`Validate availability messages for ${locationsToValidate.length} random locations`, async () => {
      for (const location of locationsToValidate) {
        await test.step(`${location.shortName} - ${location.availability}`, async () => {
          await onboardingPage.validateLocationAvailability(location);
        });
      }
    });

    await test.step(`Continue with final location: ${finalLocation.shortName}`, async () => {
      await onboardingPage.validateLocationAvailability(finalLocation);
      console.log(
        `Final location selected: ${finalLocation.shortName} - ${finalLocation.availability}`,
      );
      await onboardingPage.continueToBudgetStep();
    });

    await test.step('Complete budget step with random home price', async () => {
      await onboardingPage.continueWithoutBudget();
      await onboardingPage.expectBudgetRequiredMessage();

      const homePrice = await onboardingPage.enterRandomEstimatedBudget();
      randomSelections.homePrice = homePrice;

      await onboardingPage.continueToCashBackEstimate();
    });

    if (shouldValidateCashback) {
      await test.step('Go back, update budget, and verify cashback changes', async () => {
        await onboardingPage.continueFromCashBackEstimate();
        initialCashback = await onboardingPage.getEstimatedCashback();
        randomSelections.initialCashback = initialCashback;
        console.log(`Initial estimated cashback: ${initialCashback}`);

        if (await onboardingPage.isMortgagePreApprovalStepVisible()) {
          await onboardingPage.returnFromMortgageToBudgetStep();
        } else {
          await onboardingPage.returnFromPropertyTypeToBudgetStep();
        }

        const updatedHomePrice = await onboardingPage.enterRandomEstimatedBudget();

        randomSelections.updatedHomePrice = updatedHomePrice;

        await onboardingPage.enterEstimatedBudget(updatedHomePrice);
        await onboardingPage.continueToCashBackEstimate();

        updatedCashback = await onboardingPage.expectEstimatedCashbackNotToEqual(initialCashback);

        if (updatedCashback) {
          randomSelections.updatedCashback = updatedCashback;
          console.log(`Updated estimated cashback: ${updatedCashback}`);
        } else {
          randomSelections.updatedCashback = 'Skipped - cashback not present after budget update';
        }
      });
    } else {
      await test.step('Verify cashback estimate is not shown for non-realty location', async () => {
        await onboardingPage.expectNoEstimatedCashback();
      });

      randomSelections.initialCashback = 'Skipped - realty unavailable';
      randomSelections.updatedCashback = 'Skipped - realty unavailable';
    }

    await test.step('Handle optional mortgage step', async () => {
      if (shouldValidateCashback) {
        await onboardingPage.continueFromCashBackEstimate();
      }

      if (await onboardingPage.isMortgagePreApprovalStepVisible()) {
        randomSelections.mortgagePreApproval =
          await onboardingPage.selectRandomMortgagePreApproval();

        await onboardingPage.continueToPropertyTypeStep();
      } else {
        randomSelections.mortgagePreApproval = 'Skipped - mortgage unavailable';
        await onboardingPage.expectPropertyTypeStepVisible();
      }
    });

    await test.step('Complete property type step', async () => {
      randomSelections.propertyType = await onboardingPage.selectRandomPropertyType();
    });

    await test.step('Complete beds and baths step', async () => {
      await onboardingPage.continueToBedsAndBathsStep();

      const { bedrooms, bathrooms } = await onboardingPage.selectRandomBedroomsAndBathrooms();

      randomSelections.bedrooms = bedrooms;
      randomSelections.bathrooms = bathrooms;

      if (shouldValidateCashback) {
        const finalCashback = await onboardingPage.getEstimatedCashback();
        randomSelections.finalCashback = finalCashback;
        console.log(`Final estimated cashback before submission: ${finalCashback}`);
      } else {
        randomSelections.finalCashback = 'Skipped - realty unavailable';
      }
    });

    await test.info().attach('Random onboarding selections', {
      body: JSON.stringify(randomSelections, null, 2),
      contentType: 'application/json',
    });

    const buyerProfileResponsePromise = onboardingPage.waitForBuyerProfileResponse();

    await test.step('Submit onboarding', async () => {
      await onboardingPage.submitOnboardingAndExpectDashboard(finalLocation);
    });

    await test.step('Assert persisted buyer profile filters', async () => {
      const buyerProfile = await onboardingPage.expectPersistedBuyerProfileFilters(
        await buyerProfileResponsePromise,
        {
          location: finalLocation,
          homePrice: randomSelections.updatedHomePrice || randomSelections.homePrice,
          propertyType: randomSelections.propertyType,
          bedrooms: randomSelections.bedrooms,
          bathrooms: randomSelections.bathrooms,
        },
      );

      await test.info().attach('Buyer profile after onboarding', {
        body: JSON.stringify(buyerProfile, null, 2),
        contentType: 'application/json',
      });
    });
  });
});
