import { random } from '../../utils/random';
import { expect, Locator, Page } from '@playwright/test';
import SearchPage, {
  type PropertyIdentifier,
  type SearchWithUnsavedResults,
} from '../search/SearchPage';
import { clearRecordedToasts, expectToastVisibleOrRecorded } from '../../utils/toastRecorder';

const automatedTestCollectionNamePattern = /^Automated test [A-Z]{3}\d{3}$/i;

export default class CollectionPages {
  private currentSavedListingFolderName?: string | RegExp;
  private currentSavedListingFolderHref?: string;

  constructor(private page: Page) {}

  async createSavedListingCollectionFromResults(
    searchPage: SearchPage,
    { unsavedPropertyCards }: SearchWithUnsavedResults,
    folderName = this.createUniqueSavedListingFolderName(),
  ) {
    const propertyCard = searchPage.selectRandomUnsavedPropertyCard(unsavedPropertyCards);
    const propertyIdentifier = await searchPage.getPropertyIdentifier(propertyCard);

    await searchPage.expectPropertyIsUnsaved(propertyCard);
    await searchPage.savePropertyAndOpenSavedListingCollectionModal(
      propertyCard,
      propertyIdentifier,
    );
    await this.createNewSavedListingCollection(folderName);
    await searchPage.assertSavedToastVisible(propertyIdentifier, folderName);

    return { folderName, propertyIdentifier };
  }

  createUniqueSavedListingFolderName(excludedNames: string[] = []) {
    let folderName = '';

    do {
      folderName = `Automated test ${this.randomCharacters('ABCDEFGHIJKLMNOPQRSTUVWXYZ', 3)}${this.randomCharacters('0123456789', 3)}`;
    } while (excludedNames.includes(folderName));

    return folderName;
  }

  private async isDefaultSavedListingFolderVisibleWithinScrolls(maxScrolls: number) {
    const savedListingsPanel = this.page.getByRole('tabpanel', { name: 'Saved listings' });
    const defaultFolderLink = this.page.getByRole('link', { name: /my saved listings/i }).first();

    await savedListingsPanel
      .getByRole('link')
      .first()
      .waitFor({ state: 'visible', timeout: 20000 });

    const foundDefaultFolder = await this.scrollToSavedListingFolderLink(
      defaultFolderLink,
      'My saved listings',
      maxScrolls,
    );

    if (foundDefaultFolder) {
      console.log(
        `[saved-listing cleanup] Found "My saved listings" using the 02-spec scroll logic within ${maxScrolls} attempts.`,
      );
    }

    return foundDefaultFolder;
  }

  private async resetSavedListingsScrollToTop() {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);

      for (const element of Array.from(document.querySelectorAll<HTMLElement>('*'))) {
        if (element.scrollHeight > element.clientHeight + 2) {
          element.scrollTop = 0;
        }
      }
    });

    await this.page.waitForTimeout(300);
  }

  async goToSavedPageFromSideNav() {
    await this.page.getByRole('link', { name: 'Saved', exact: true }).click();
    await expect(this.page).toHaveURL(/saved-searches|homelist/);
  }

  async openSavedListingsSection() {
    await this.page.getByText('Saved listings', { exact: true }).first().click();
    await expect(this.page).toHaveURL(/homelist/);
    await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
  }

  async assertSavedListingFolderVisible(folderName: string) {
    await this.waitForSavedListingFolderLink(folderName);
  }

  async assertSavedListingCollectionNotVisible(folderName: string) {
    await this.reloadSavedListingsSection();
    await expect(
      this.savedListingFolderLink(folderName),
      `Expected saved listing folder "${folderName}" to be deleted.`,
    ).toHaveCount(0);
  }

  async openSavedListingFolder(folderName: string | RegExp) {
    const folderLink = await this.waitForSavedListingFolderLink(folderName);
    const folderHref = await folderLink.getAttribute('href');

    this.currentSavedListingFolderName = folderName;
    this.currentSavedListingFolderHref = folderHref ?? undefined;
    await folderLink.scrollIntoViewIfNeeded();

    if (folderHref) {
      await this.page.goto(folderHref);
    } else {
      await folderLink.click();
    }

    await expect(this.page).toHaveURL(/homelist\/.+/);
    await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
  }

  async renameSavedListingCollection(oldName: string, newName: string) {
    expect(newName, 'Renamed collection name must be different from the original name.').not.toBe(
      oldName,
    );

    const menu = await this.openCollectionActionsMenu(oldName);
    await menu.getByText('Rename', { exact: true }).click();

    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: 'Rename this collection' })
      .first();
    await expect(dialog, 'Expected rename collection modal to open.').toBeVisible();

    const titleInput = dialog.getByPlaceholder(/add a title/i);
    await expect(titleInput).toHaveValue(oldName);
    await titleInput.fill(newName);
    await expect(titleInput).toHaveValue(newName);

    const saveButton = dialog.getByRole('button', { name: 'Save', exact: true });
    await expect(saveButton).toBeEnabled();
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await expect(this.page.getByText(newName, { exact: true }).first()).toBeVisible({
      timeout: 20000,
    });

    if (this.currentSavedListingFolderName === oldName) {
      this.currentSavedListingFolderName = newName;
      this.currentSavedListingFolderHref = undefined;
    }
  }

  async assertPropertyVisibleInSavedFolder(propertyIdentifier: PropertyIdentifier) {
    const propertyCard = this.propertyCardByIdentifier(propertyIdentifier);
    const assertionMessage = `Expected saved folder to contain "${propertyIdentifier.titleOrAddress}".`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await expect(propertyCard, assertionMessage).toBeVisible({ timeout: 20000 });
        return;
      } catch {
        if (!this.currentSavedListingFolderName) {
          break;
        }

        await this.reloadCurrentSavedListingFolder();
      }
    }

    await expect(propertyCard, assertionMessage).toBeVisible({ timeout: 30000 });
  }

  async removePropertyFromAllCollections(propertyIdentifier: PropertyIdentifier) {
    const propertyCard = this.propertyCardByIdentifier(propertyIdentifier);
    const saveButton = propertyCard
      .getByRole('button', { name: 'Remove from collection', exact: true })
      .first();

    await propertyCard.scrollIntoViewIfNeeded();
    await expect(
      propertyCard,
      `Expected to find "${propertyIdentifier.titleOrAddress}" before updating collections.`,
    ).toBeVisible();
    await saveButton.scrollIntoViewIfNeeded();
    await expect(
      saveButton,
      `Expected saved icon for "${propertyIdentifier.titleOrAddress}" before updating collections.`,
    ).toBeVisible();
    await saveButton.click();

    const dialog = this.page.getByRole('dialog').filter({ hasText: 'Saved listings' }).first();
    await expect(dialog, 'Expected saved listings modal to open.').toBeVisible();

    const checkedCollections = this.checkedCollectionCards(dialog);
    const checkedCollectionCount = await checkedCollections.count();
    expect(
      checkedCollectionCount,
      'Expected at least one checked collection for the saved property.',
    ).toBeGreaterThan(0);

    while ((await checkedCollections.count()) > 0) {
      await checkedCollections.first().scrollIntoViewIfNeeded();
      await checkedCollections.first().click();
    }

    await expect(
      checkedCollections,
      'Expected every checked saved listing collection to be unchecked.',
    ).toHaveCount(0);

    const updateChangesButton = dialog.getByRole('button', { name: /update changes/i });
    await expect(updateChangesButton).toBeEnabled();
    await clearRecordedToasts(this.page);
    await updateChangesButton.click();
    await this.assertCollectionUpdateToastVisible();

    await expect(dialog)
      .toBeHidden({ timeout: 5000 })
      .catch(async () => {
        await dialog
          .getByRole('button', { name: /close/i })
          .click({ timeout: 5000 })
          .catch(() => {});
        await expect(dialog).toBeHidden();
      });
  }

  async assertSavedListingFolderEmpty(propertyIdentifier: PropertyIdentifier) {
    await expect(
      this.propertyCardByIdentifier(propertyIdentifier),
      `Expected "${propertyIdentifier.titleOrAddress}" to be removed from the saved folder.`,
    ).toBeHidden();
    await expect(
      this.propertyCards(),
      'Expected saved listing folder to have no property cards.',
    ).toHaveCount(0);
  }

  async deleteSavedListingCollection(collectionName: string) {
    const menu = await this.openCollectionActionsMenu(collectionName);
    await menu.getByText('Delete', { exact: true }).click();

    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: 'Delete this collection?' })
      .first();
    await expect(dialog, 'Expected delete collection confirmation modal to open.').toBeVisible();
    await expect(dialog.getByText(collectionName)).toBeVisible();
    await expect(dialog.getByRole('button', { name: /don.t delete/i })).toBeVisible();

    const yesDeleteButton = dialog.getByRole('button', { name: /yes,?\s*delete/i });
    await expect(yesDeleteButton).toBeVisible();
    await yesDeleteButton.click();
    await expect(dialog).toBeHidden();
    await expect(this.page).toHaveURL(/homelist/);
    await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();

    if (this.currentSavedListingFolderName === collectionName) {
      this.currentSavedListingFolderName = undefined;
      this.currentSavedListingFolderHref = undefined;
    }
  }

  private async createNewSavedListingCollection(folderName: string) {
    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /saved listings/i })
      .first();

    await expect(dialog, 'Expected saved listing collection modal to be visible.').toBeVisible();

    const createCollectionButton = dialog.getByRole('button', { name: /create a new collection/i });
    await expect(
      createCollectionButton,
      'Expected "Create a new collection" button to be visible in the saved listings modal.',
    ).toBeVisible();
    await expect(createCollectionButton).toBeEnabled();
    await createCollectionButton.scrollIntoViewIfNeeded();
    await createCollectionButton.click();

    const createCollectionDialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /create a new collection/i })
      .first();
    await expect(createCollectionDialog, 'Expected create collection modal to open.').toBeVisible();

    const titleInput = createCollectionDialog.getByPlaceholder(/add a title/i);
    await expect(titleInput).toBeVisible();
    await titleInput.fill(folderName);
    await expect(titleInput).toHaveValue(folderName);

    const savePropertyButton = createCollectionDialog.getByRole('button', {
      name: /save property/i,
    });
    await expect(savePropertyButton).toBeEnabled();
    await clearRecordedToasts(this.page);
    await savePropertyButton.click();
    await expect(createCollectionDialog).toBeHidden();
    await expect(dialog).toBeHidden();
  }

  private async openCollectionActionsMenu(collectionName: string) {
    await expect(this.page.getByText(collectionName, { exact: true }).first()).toBeVisible();

    const menuButton = this.collectionActionsMenuButton();
    await menuButton.scrollIntoViewIfNeeded();
    await expect(
      menuButton,
      `Expected actions menu button for "${collectionName}" to be visible.`,
    ).toBeVisible();
    await menuButton.click();

    const menu = this.collectionActionsMenu();
    await expect(menu.getByText('Rename', { exact: true })).toBeVisible();
    await expect(menu.getByText('Delete', { exact: true })).toBeVisible();

    return menu;
  }

  private collectionActionsMenuButton() {
    return this.page.locator('button:has(svg path[d^="M144,128"])').first();
  }

  private collectionActionsMenu() {
    return this.page
      .locator(
        '[data-radix-popper-content-wrapper] [data-slot="popover-content"][data-state="open"]',
      )
      .filter({ hasText: 'Rename' })
      .filter({ hasText: 'Delete' })
      .first();
  }

  private savedListingFolderLink(folderName: string) {
    return this.savedListingFolderLinkByName(new RegExp(this.escapeRegExp(folderName), 'i'));
  }

  private savedListingFolderLinkByName(name: RegExp) {
    return this.page.getByRole('link', { name }).first();
  }

  private async waitForSavedListingFolderLink(folderName: string | RegExp) {
    const folderLink =
      typeof folderName === 'string'
        ? this.savedListingFolderLink(folderName)
        : this.savedListingFolderLinkByName(folderName);
    const folderNameText = folderName.toString();

    for (let attempt = 0; attempt < 3; attempt += 1) {
      if (await this.scrollToSavedListingFolderLink(folderLink, folderNameText)) {
        return folderLink;
      }

      await this.reloadSavedListingsSection();
    }

    await expect(
      folderLink,
      `Expected saved listing folder "${folderNameText}" to be visible after scrolling and refreshing Saved listings.`,
    ).toBeVisible({
      timeout: 20000,
    });

    return folderLink;
  }

  private async scrollToSavedListingFolderLink(
    folderLink: Locator,
    folderNameText: string,
    maxScrollAttempts = 7,
  ) {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
      const scrollableElements = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
        (element) => element.scrollHeight > element.clientHeight + 2,
      );

      for (const element of scrollableElements) {
        element.scrollTop = 0;
      }
    });

    for (let attempt = 0; attempt < maxScrollAttempts; attempt += 1) {
      try {
        await expect(
          folderLink,
          `Expected saved listing folder "${folderNameText}" to be visible.`,
        ).toBeVisible({
          timeout: 1500,
        });
        await folderLink.scrollIntoViewIfNeeded();

        return true;
      } catch {
        const { reachedBottom, moved } = await this.page.evaluate(() => {
          const scrollAmount = Math.max(window.innerHeight * 0.85, 500);
          const scrollableElements = [
            document.scrollingElement,
            ...Array.from(document.querySelectorAll<HTMLElement>('*')),
          ].filter((element): element is Element => {
            if (!element || element.scrollHeight <= element.clientHeight + 2) {
              return false;
            }

            const style = window.getComputedStyle(element);

            return /(auto|scroll|overlay)/.test(style.overflowY);
          });

          let moved = false;
          let canMoveFurther = false;

          for (const element of scrollableElements) {
            const previousTop = element.scrollTop;
            const maxTop = element.scrollHeight - element.clientHeight;

            element.scrollTop = Math.min(maxTop, previousTop + scrollAmount);
            moved = moved || element.scrollTop !== previousTop;
            canMoveFurther = canMoveFurther || element.scrollTop < maxTop - 2;
          }

          return { reachedBottom: !canMoveFurther, moved };
        });

        if (reachedBottom || !moved) {
          break;
        }

        await this.page.waitForTimeout(500);
      }
    }

    return false;
  }

  private async reloadSavedListingsSection() {
    await this.page.goto('/dashboard/homelist');
    await expect(this.page).toHaveURL(/homelist/);
    await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
  }

  private async reloadCurrentSavedListingFolder() {
    if (!this.currentSavedListingFolderName) {
      await this.page.reload();
      await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
      return;
    }

    if (this.currentSavedListingFolderHref) {
      await this.page.goto(this.currentSavedListingFolderHref);
      await expect(this.page).toHaveURL(/homelist\/.+/);
      await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
      return;
    }

    await this.reloadSavedListingsSection();
    await this.openSavedListingFolder(this.currentSavedListingFolderName);
  }

  private checkedCollectionCards(dialog: Locator) {
    // Selected check uses bg-brand on prod main; bg-primary after color-token migration.
    return dialog
      .locator('div.relative.cursor-pointer.space-y-5')
      .filter({ has: this.page.locator('.bg-brand, .bg-primary') });
  }

  private async assertCollectionUpdateToastVisible() {
    const toastText = /updated|saved|removed|changes/i;
    const toast = this.page
      .locator('[data-sonner-toast]')
      .filter({ hasNotText: /privacy choices/i })
      .filter({ hasText: toastText })
      .first();

    await expectToastVisibleOrRecorded(
      this.page,
      toast,
      toastText,
      'Expected a success toast after updating saved listing collections.',
    );
  }

  private propertyCardByIdentifier(propertyIdentifier: PropertyIdentifier): Locator {
    if (propertyIdentifier.propertyId) {
      return this.propertyCards()
        .filter({ has: this.page.locator(`a[href*="${propertyIdentifier.propertyId}"]`) })
        .first();
    }

    return this.propertyCards().filter({ hasText: propertyIdentifier.titleOrAddress }).first();
  }

  private propertyCards() {
    return this.page.locator('div[class*="group/property-card"]');
  }

  private randomCharacters(characters: string, length: number) {
    return Array.from(
      { length },
      () => characters[Math.floor(random() * characters.length)]!,
    ).join('');
  }

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
