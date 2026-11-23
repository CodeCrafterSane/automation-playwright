import { test } from '../../fixtures/auth.fixture';
import SavedListingsPage from '../../pages/collection/SavedListingsPage';
import SearchPage from '../../pages/search/SearchPage';

const MIN_UNSAVED_PROPERTY_CARDS = 1;

test.describe('@P1 Search', () => {
  test.use({ role: 'BUYER' });

  test('user can save and unsave a property from default saved listings', async ({ page }, testInfo) => {
    testInfo.setTimeout(180000);

    const searchPage = new SearchPage(page);
    const savedListingsPage = new SavedListingsPage(page);

    const searchResults = await test.step('Find unsaved search results', () =>
      searchPage.prepareSearchWithUnsavedResults(MIN_UNSAVED_PROPERTY_CARDS),
    );
    const propertyIdentifier = await test.step('Save a property from search results', () =>
      searchPage.saveRandomPropertyFromResults(searchResults),
    );

    await test.step('Verify and remove the property from default saved listings', async () => {
      await savedListingsPage.goToSavedPageFromSideNav();
      await savedListingsPage.openSavedListingsSection();
      await savedListingsPage.openDefaultSavedListingFolder();
      await savedListingsPage.assertPropertyVisibleInSavedFolder(propertyIdentifier);
      await savedListingsPage.unsavePropertyFromSavedFolder(propertyIdentifier);
      await searchPage.assertUnsavedToastVisible(propertyIdentifier);
      await savedListingsPage.assertPropertyNotVisibleInSavedFolder(propertyIdentifier);
    });
  });
});
