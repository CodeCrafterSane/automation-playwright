import { test } from '../../fixtures/base.fixture';
import MlsListingPage, {
  type ListingContext,
} from '../../pages/mls-listing/MlsListingPage';

test.describe('MLS listing page compliance @P2', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('validates all 14 MLS compliance requirements on five listings', async ({ page }, testInfo) => {
    test.setTimeout(15 * 60 * 1000);

    const mlsListingPage = new MlsListingPage(page);
    const runPlan = mlsListingPage.createRunPlan();
    const runResult = mlsListingPage.createRunResult();

    mlsListingPage.logRunPlan(runPlan);

    await test.step('Start from a fresh logged-out public search page', async () => {
      await mlsListingPage.openPublicSearchFromLoggedOutState();
    });

    for (const requiredState of runPlan.stateOrder) {
      let completedStateSlot = false;

      while (!completedStateSlot && runPlan.remainingLocations[requiredState].length > 0) {
        const selectedLocation = runPlan.remainingLocations[requiredState].shift();
        if (!selectedLocation) break;

        runResult.searchedLocations.push(selectedLocation.label);

        await test.step(`Reset search before ${selectedLocation.label}`, async () => {
          await mlsListingPage.resetSearch();
        });

        const candidate = await mlsListingPage.findPropertyCandidate(
          selectedLocation,
          runResult.testedPropertyUrls,
        );

        if (!candidate) continue;

        const context: ListingContext = {
          location: selectedLocation.label,
          propertyUrl: candidate.url,
        };

        await test.step(`Validate listing from ${selectedLocation.label}`, async () => {
          try {
            context.propertyUrl = await mlsListingPage.openListing(
              candidate,
              runResult.testedPropertyUrls,
            );

            const failures = await mlsListingPage.validateAllComplianceChecks(context, testInfo);
            runResult.complianceFailures.push(
              ...failures.map((failure) => `${selectedLocation.label}: ${failure}`),
            );
          } catch (error) {
            await mlsListingPage.attachFailureDiagnostics(testInfo, context, error);
            throw error;
          }
        });

        runResult.testedPropertyUrls.add(context.propertyUrl);
        runResult.testedLocations.push(selectedLocation.label);
        completedStateSlot = true;
      }

      if (!completedStateSlot) break;
    }

    await test.step('End on a fresh public search page', async () => {
      await mlsListingPage.resetSearch();
    });

    mlsListingPage.logRunResult(runResult);
    mlsListingPage.expectRunCompleted(runResult);
  });
});
