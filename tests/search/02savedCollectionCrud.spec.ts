import { test } from '../../fixtures/auth.fixture';
import CollectionPages from '../../pages/collection/CollectionPages';
import SearchPage from '../../pages/search/SearchPage';

const MIN_UNSAVED_PROPERTY_CARDS = 1;

test.describe('@P1 Search', () => {
  test.use({ role: 'BUYER' });

  test('user can create, rename, and delete a saved listing collection', async ({
    page,
  }, testInfo) => {
    testInfo.setTimeout(180000);

    const searchPage = new SearchPage(page);
    const collectionPages = new CollectionPages(page);

    const searchResults = await test.step('Find unsaved search results', () =>
      searchPage.prepareSearchWithUnsavedResults(MIN_UNSAVED_PROPERTY_CARDS),
    );
    const { folderName, propertyIdentifier } = await test.step(
      'Create a saved listing collection from search',
      () => collectionPages.createSavedListingCollectionFromResults(searchPage, searchResults),
    );

    await test.step('Verify, rename, and delete the saved listing collection', async () => {
      await collectionPages.goToSavedPageFromSideNav();
      await collectionPages.openSavedListingsSection();
      await collectionPages.assertSavedListingFolderVisible(folderName);
      await collectionPages.openSavedListingFolder(folderName);
      await collectionPages.assertPropertyVisibleInSavedFolder(propertyIdentifier);

      const renamedCollectionFolderName = collectionPages.createUniqueSavedListingFolderName([
        folderName,
      ]);

      await collectionPages.renameSavedListingCollection(
        folderName,
        renamedCollectionFolderName,
      );
      await collectionPages.assertPropertyVisibleInSavedFolder(propertyIdentifier);
      await collectionPages.removePropertyFromAllCollections(propertyIdentifier);
      await collectionPages.assertSavedListingFolderEmpty(propertyIdentifier);
      await collectionPages.deleteSavedListingCollection(renamedCollectionFolderName);
      await collectionPages.assertSavedListingCollectionNotVisible(renamedCollectionFolderName);
    });
  });
});
