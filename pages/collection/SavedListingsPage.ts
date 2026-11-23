import { expect, Locator, Page } from '@playwright/test';
import type { PropertyIdentifier } from '../search/SearchPage';
import { clearRecordedToasts, expectToastVisibleOrRecorded } from '../../utils/toastRecorder';

export type SavedSearchKeyword = {
  input: string;
  option: string;
};

export type SavedSearchEditDetails = {
  features: string[];
  keywords: SavedSearchKeyword[];
  lotSqftMax: string;
  lotSqftMin: string;
  maxPriceLabel: string;
  propertyTypes: string[];
  searchName: string;
  sqftMax: string;
  sqftMin: string;
};

export default class SavedListingsPage {
  private currentSavedListingFolderName?: string | RegExp;
  private currentSavedListingFolderHref?: string;

  constructor(private page: Page) {}

  async goToSavedPageFromSideNav() {
    await this.page.getByRole('link', { name: 'Saved', exact: true }).click();
    await expect(this.page).toHaveURL(/saved-searches|homelist/);
  }

  async openSavedListingsSection() {
    await this.page.getByText('Saved listings', { exact: true }).first().click();
    await expect(this.page).toHaveURL(/homelist/);
    await expect(this.page.getByRole('tabpanel', { name: 'Saved listings' })).toBeVisible();
  }

  async openSavedSearchesSection() {
    const savedSearchesTab = this.page.getByText('Saved searches', { exact: true }).first();

    if (await savedSearchesTab.isVisible().catch(() => false)) {
      await savedSearchesTab.click();
    } else {
      await this.page.goto('/dashboard/saved-searches');
    }

    await expect(this.page).toHaveURL(/saved-searches/);
    await expect(
      this.page.getByText(/saved searches/i).first(),
      'Expected Saved searches section to be visible.',
    ).toBeVisible();
  }

  async renameNewestSavedSearch(savedSearchName: string, renamedSavedSearchName: string) {
    expect(
      renamedSavedSearchName,
      'Renamed saved search name must be different from the original name.',
    ).not.toBe(savedSearchName);

    await this.waitForNewestSavedSearch(savedSearchName);
    const menu = await this.openNewestSavedSearchActionsMenu(savedSearchName);
    const editMenuItem = menu
      .getByText(/^(Edit|Rename)$/i)
      .or(menu.getByRole('menuitem', { name: /edit|rename/i }))
      .filter({ visible: true })
      .first();

    await expect(
      editMenuItem,
      'Expected saved search actions menu to include Edit/Rename.',
    ).toBeVisible();
    await editMenuItem.click();

    const dialog = this.page
      .getByRole('dialog')
      .filter({ hasText: /edit|rename|saved search|search name/i })
      .first();

    await expect(dialog, 'Expected saved search edit dialog to open.').toBeVisible({
      timeout: 20000,
    });

    const nameInput = dialog
      .getByRole('textbox')
      .or(dialog.locator('input, textarea'))
      .filter({ visible: true })
      .first();

    await expect(
      nameInput,
      'Expected saved search edit dialog to expose a name input.',
    ).toBeVisible();
    await nameInput.fill(renamedSavedSearchName);
    await expect(nameInput).toHaveValue(renamedSavedSearchName);

    const saveButton = dialog
      .getByRole('button', { name: /^(Save|Update|Done)$/i })
      .filter({ visible: true })
      .first();

    await expect(saveButton, 'Expected saved search edit dialog save/update button.').toBeEnabled();
    await saveButton.click();
    await expect(dialog).toBeHidden({ timeout: 30000 });
    await this.waitForNewestSavedSearch(renamedSavedSearchName);
  }

  async renameTopSavedSearch(renamedSavedSearchName: string) {
    const menu = await this.openTopSavedSearchEditControl();

    if (
      await this.savedSearchEditDialog()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      await this.fillSavedSearchEditDialog(renamedSavedSearchName);
      await this.waitForNewestSavedSearch(renamedSavedSearchName);
      return;
    }

    const editMenuItem = menu
      .getByText(/^(Edit|Rename)$/i)
      .or(menu.getByRole('menuitem', { name: /edit|rename/i }))
      .filter({ visible: true })
      .first();
    await expect(
      editMenuItem,
      'Expected top saved search actions menu to include Edit/Rename.',
    ).toBeVisible();
    await editMenuItem.click();
    await this.fillSavedSearchEditDialog(renamedSavedSearchName);
    await this.waitForNewestSavedSearch(renamedSavedSearchName);
  }

  async editTopSavedSearchNameAndMaxPrice(searchName: string, maxPriceLabel: string) {
    await this.openTopSavedSearchEditDialog();
    const dialog = this.savedSearchEditDialog();

    await this.fillSavedSearchName(dialog, searchName);
    await this.selectSavedSearchMaxPrice(dialog, maxPriceLabel);
    await this.saveSavedSearchEditDialog(dialog);
  }

  async assertTopSavedSearchNameAndMaxPricePersisted(searchName: string, maxPriceLabel: string) {
    await this.page.reload();
    await this.openSavedSearchesSection();
    await this.openTopSavedSearchEditDialog();

    const dialog = this.savedSearchEditDialog();

    await expect(dialog.getByRole('textbox', { name: /name of your search/i })).toHaveValue(
      searchName,
    );
    await this.expectSavedSearchPriceValue(dialog, maxPriceLabel);
    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toBeHidden();
  }

  async assertTopSavedSearchEditRefetchesCurrentValues() {
    await this.assertSavedSearchEditRefetchesCurrentValues(0);
  }

  async previewTopSavedSearchNameAndMaxPriceEdit(searchName: string, maxPriceLabel: string) {
    await this.previewSavedSearchNameAndMaxPriceEdit(searchName, maxPriceLabel, 0);
  }

  async updateTopSavedSearchEmailFrequency() {
    await this.updateSavedSearchEmailFrequency(0);
  }

  async assertSavedSearchEditRefetchesCurrentValues(savedSearchIndex = 0) {
    await this.openSavedSearchEditDialog(savedSearchIndex);

    const dialog = this.savedSearchEditDialog();
    const nameInput = dialog.getByRole('textbox', { name: /name of your search/i });
    const maxPriceInput = dialog.getByRole('textbox', { name: /max price/i }).last();
    const currentName = await nameInput.inputValue();
    const currentMaxPrice = await maxPriceInput.inputValue();

    expect(
      currentName,
      'Expected top saved search edit dialog to expose a saved search name.',
    ).not.toBe('');
    expect(
      currentMaxPrice,
      'Expected top saved search edit dialog to expose a max price.',
    ).not.toBe('');

    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toBeHidden();
    await this.page.reload();
    await this.openSavedSearchesSection();
    await this.openSavedSearchEditDialog(savedSearchIndex);

    const refetchedDialog = this.savedSearchEditDialog();

    await expect(
      refetchedDialog.getByRole('textbox', { name: /name of your search/i }),
    ).toHaveValue(currentName);
    await expect(refetchedDialog.getByRole('textbox', { name: /max price/i }).last()).toHaveValue(
      currentMaxPrice,
    );
    await refetchedDialog.getByRole('button', { name: /close/i }).click();
    await expect(refetchedDialog).toBeHidden();
  }

  async previewSavedSearchNameAndMaxPriceEdit(
    searchName: string,
    maxPriceLabel: string,
    savedSearchIndex = 0,
  ) {
    await this.openSavedSearchEditDialog(savedSearchIndex);

    const dialog = this.savedSearchEditDialog();

    await this.fillSavedSearchName(dialog, searchName);
    await this.selectSavedSearchMaxPrice(dialog, maxPriceLabel);
    await expect(dialog.getByRole('textbox', { name: /name of your search/i })).toHaveValue(
      searchName,
    );
    await this.expectSavedSearchPriceValue(dialog, maxPriceLabel);
    await dialog.getByRole('button', { name: /cancel changes/i }).click();
    await expect(dialog).toBeHidden();
  }

  async editTopSavedSearchDetails(details: SavedSearchEditDetails) {
    await this.openTopSavedSearchEditDialog();
    const dialog = this.savedSearchEditDialog();

    await this.fillSavedSearchName(dialog, details.searchName);
    await this.selectSavedSearchMaxPrice(dialog, details.maxPriceLabel);
    await dialog.locator('input[name="sqft__gte"]').fill(details.sqftMin);
    await dialog.locator('input[name="sqft__lte"]').fill(details.sqftMax);
    await dialog.locator('input[name="lot_sqft__gte"]').fill(details.lotSqftMin);
    await dialog.locator('input[name="lot_sqft__lte"]').fill(details.lotSqftMax);
    await this.selectFirstSavedSearchComboboxOption(dialog, 'Less than 7 days');

    await this.toggleSavedSearchButton(dialog, 'All');

    for (const feature of details.features) {
      await this.ensureSavedSearchCheckboxChecked(dialog, feature);
    }

    await this.clearSavedSearchKeywordsIfPresent(dialog);

    for (const keyword of details.keywords) {
      await this.addSavedSearchKeyword(dialog, keyword.input, keyword.option);
    }

    await this.saveSavedSearchEditDialog(dialog);
    await this.waitForNewestSavedSearch(details.searchName);
  }

  async assertTopSavedSearchEditPersisted(details: SavedSearchEditDetails) {
    await this.page.reload();
    await this.openSavedSearchesSection();
    await this.openTopSavedSearchEditDialog();

    const dialog = this.savedSearchEditDialog();

    await expect(dialog.getByRole('textbox', { name: /name of your search/i })).toHaveValue(
      details.searchName,
    );
    await this.expectSavedSearchPriceValue(dialog, details.maxPriceLabel);
    await expect(dialog.locator('input[name="sqft__gte"]')).toHaveValue(details.sqftMin);
    await expect(dialog.locator('input[name="sqft__lte"]')).toHaveValue(details.sqftMax);
    await expect(dialog.locator('input[name="lot_sqft__gte"]')).toHaveValue(details.lotSqftMin);
    await expect(dialog.locator('input[name="lot_sqft__lte"]')).toHaveValue(details.lotSqftMax);

    await expect(dialog.getByRole('button', { name: /^All$/i })).toBeVisible();

    for (const feature of details.features) {
      const checkbox = dialog
        .getByRole('checkbox', { name: new RegExp(this.escapeRegExp(feature), 'i') })
        .first();

      await expect(
        checkbox,
        `Expected persisted feature "${feature}" to be checked.`,
      ).toBeChecked();
    }

    for (const keyword of details.keywords) {
      await expect(
        dialog.getByText(new RegExp(this.escapeRegExp(keyword.option), 'i')),
        `Expected persisted keyword "${keyword.option}" to be visible.`,
      ).toBeVisible();
    }

    await dialog.getByRole('button', { name: /close/i }).click();
    await expect(dialog).toBeHidden();
  }

  async updateSavedSearchEmailFrequency(savedSearchIndex = 0) {
    await this.savedSearchCard(savedSearchIndex).getByRole('combobox').first().click();
    await this.selectOpenDropdownOption('Daily');
    await expect(
      this.savedSearchCard(savedSearchIndex).getByRole('combobox').filter({ hasText: 'Daily' }),
    ).toBeVisible();

    const dailyComboboxes = this.savedSearchCard(savedSearchIndex).getByRole('combobox');

    if ((await dailyComboboxes.count()) > 1) {
      await dailyComboboxes.nth(1).click();
      await this.selectOpenDropdownOption('Wednesday');
      await expect(
        this.savedSearchCard(savedSearchIndex)
          .getByRole('combobox')
          .filter({ hasText: 'Wednesday' }),
      ).toBeVisible();
    }

    await this.savedSearchCard(savedSearchIndex)
      .getByRole('combobox')
      .filter({ hasText: 'Daily' })
      .click();
    await this.selectOpenDropdownOption('Off');
    await expect(
      this.savedSearchCard(savedSearchIndex).getByRole('combobox').filter({ hasText: 'Off' }),
    ).toBeVisible();
  }

  async openDefaultSavedListingFolder() {
    // Default collection title is "Saved listings" (the example UI homelist toast/card copy).
    // Link accessible name may also include a "Default" badge, so match as a prefix.
    await this.openSavedListingFolder(/my saved listings/i);
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

  async unsavePropertyFromSavedFolder(propertyIdentifier: PropertyIdentifier) {
    const propertyCard = this.propertyCardByIdentifier(propertyIdentifier);
    const saveButton = propertyCard
      .getByRole('button', { name: 'Remove from collection', exact: true })
      .first();

    await propertyCard.scrollIntoViewIfNeeded();
    await expect(
      propertyCard,
      `Expected to find "${propertyIdentifier.titleOrAddress}" before unsaving it.`,
    ).toBeVisible();
    await saveButton.scrollIntoViewIfNeeded();
    await expect(
      saveButton,
      `Expected saved icon for "${propertyIdentifier.titleOrAddress}" before unsaving it.`,
    ).toBeVisible();
    await expect(saveButton).toBeEnabled();
    await clearRecordedToasts(this.page);
    await saveButton.click();
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

  async assertPropertyNotVisibleInSavedFolder(propertyIdentifier: PropertyIdentifier) {
    const propertyCard = this.propertyCardByIdentifier(propertyIdentifier);
    const assertionMessage = `Expected "${propertyIdentifier.titleOrAddress}" to no longer be visible in the saved folder.`;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await expect(propertyCard, assertionMessage).toBeHidden({ timeout: 5000 });
        return;
      } catch {
        if (!this.currentSavedListingFolderName) {
          break;
        }

        await this.reloadCurrentSavedListingFolder();
      }
    }

    await expect(propertyCard, assertionMessage).toBeHidden({ timeout: 20000 });
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

  private async waitForNewestSavedSearch(savedSearchName: string) {
    const savedSearchText = this.page.getByText(savedSearchName, { exact: true }).first();

    await expect(
      savedSearchText,
      `Expected newly saved search "${savedSearchName}" to be visible in Saved searches.`,
    ).toBeVisible({ timeout: 30000 });
    await savedSearchText.scrollIntoViewIfNeeded();
  }

  private async openNewestSavedSearchActionsMenu(savedSearchName: string) {
    const savedSearchText = this.page.getByText(savedSearchName, { exact: true }).first();
    const savedSearchCard = savedSearchText
      .locator(
        'xpath=ancestor::*[self::article or self::li or @role="listitem" or contains(@class, "card") or contains(@class, "rounded")][1]',
      )
      .first();
    const scopedMenuButton = savedSearchCard
      .locator('button')
      .filter({ has: this.page.locator('svg') })
      .last();
    const topMenuButton = this.page
      .locator('button')
      .filter({ has: this.page.locator('svg') })
      .filter({ visible: true })
      .last();
    const menuButton = (await scopedMenuButton.isVisible().catch(() => false))
      ? scopedMenuButton
      : topMenuButton;

    await expect(
      menuButton,
      `Expected actions menu button for saved search "${savedSearchName}" to be visible.`,
    ).toBeVisible();
    await menuButton.click();

    const menu = this.page
      .locator('[role="menu"], [data-radix-popper-content-wrapper], [data-slot="popover-content"]')
      .filter({ hasText: /edit|rename/i })
      .filter({ visible: true })
      .last();

    await expect(menu, 'Expected saved search actions menu to open.').toBeVisible();

    return menu;
  }

  private async openTopSavedSearchEditControl() {
    return this.openSavedSearchEditControl(0);
  }

  private async openSavedSearchEditControl(savedSearchIndex: number) {
    const savedSearchLink = this.savedSearchLink(savedSearchIndex);
    const savedSearchCard = this.savedSearchCard(savedSearchIndex);
    const menuButton = savedSearchLink.locator('xpath=../preceding-sibling::*[1]//button').last();

    await expect(
      savedSearchCard,
      `Expected saved search card ${savedSearchIndex + 1} to be visible.`,
    ).toBeVisible({
      timeout: 30000,
    });
    await expect(
      menuButton,
      `Expected saved search card ${savedSearchIndex + 1} to expose an actions button.`,
    ).toBeVisible();
    await menuButton.click();

    const menu = this.page
      .locator('[role="menu"], [data-radix-popper-content-wrapper], [data-slot="popover-content"]')
      .filter({ hasText: /edit|rename/i })
      .filter({ visible: true })
      .last();

    return menu;
  }

  private async openTopSavedSearchEditDialog() {
    await this.openSavedSearchEditDialog(0);
  }

  private async openSavedSearchEditDialog(savedSearchIndex: number) {
    const menu = await this.openSavedSearchEditControl(savedSearchIndex);

    if (
      await this.savedSearchEditDialog()
        .isVisible({ timeout: 3000 })
        .catch(() => false)
    ) {
      return;
    }

    const editMenuItem = menu
      .getByText(/^(Edit|Rename)$/i)
      .or(menu.getByRole('menuitem', { name: /edit|rename/i }))
      .filter({ visible: true })
      .first();

    await expect(
      editMenuItem,
      'Expected top saved search actions menu to include Edit/Rename.',
    ).toBeVisible();
    await editMenuItem.click();
    await expect(
      this.savedSearchEditDialog(),
      'Expected saved search edit dialog to open.',
    ).toBeVisible({
      timeout: 20000,
    });
  }

  private savedSearchEditDialog() {
    return this.page
      .getByRole('dialog', { name: /edit search/i })
      .or(this.page.getByRole('dialog').filter({ hasText: /edit search|name of your search/i }))
      .first();
  }

  private async fillSavedSearchEditDialog(renamedSavedSearchName: string) {
    const dialog = this.savedSearchEditDialog();

    await expect(dialog, 'Expected saved search edit dialog to open.').toBeVisible({
      timeout: 20000,
    });
    await this.fillSavedSearchName(dialog, renamedSavedSearchName);
    await this.saveSavedSearchEditDialog(dialog);
  }

  private async fillSavedSearchName(dialog: Locator, searchName: string) {
    const nameInput = dialog.getByRole('textbox', { name: /name of your search/i }).first();

    await expect(
      nameInput,
      'Expected saved search edit dialog to expose a name input.',
    ).toBeVisible();
    await nameInput.fill(searchName);
    await expect(nameInput).toHaveValue(searchName);
  }

  private async selectSavedSearchMaxPrice(dialog: Locator, maxPriceLabel: string) {
    const maxPriceInput = dialog.getByRole('textbox', { name: /max price/i }).last();

    await expect(
      maxPriceInput,
      'Expected saved search edit dialog to expose max price input.',
    ).toBeVisible();
    await maxPriceInput.click();
    await this.page.getByText(maxPriceLabel, { exact: true }).click();
  }

  private async expectSavedSearchPriceValue(dialog: Locator, maxPriceLabel: string) {
    const expectedValue = this.savedSearchPriceLabelToInputValue(maxPriceLabel);
    const maxPriceInput = dialog.getByRole('textbox', { name: /max price/i }).last();

    await expect(maxPriceInput).toHaveValue(expectedValue);
  }

  private async toggleSavedSearchButton(dialog: Locator, name: string) {
    const button = dialog
      .getByRole('button', { name: new RegExp(`^${this.escapeRegExp(name)}$`, 'i') })
      .first();

    await expect(
      button,
      `Expected saved search edit button "${name}" to be visible.`,
    ).toBeVisible();
    await button.click();
  }

  private async ensureSavedSearchCheckboxChecked(dialog: Locator, name: string) {
    const checkbox = dialog
      .getByRole('checkbox', { name: new RegExp(this.escapeRegExp(name), 'i') })
      .first();

    if (await checkbox.isChecked().catch(() => false)) {
      return;
    }

    if (await checkbox.isVisible().catch(() => false)) {
      await checkbox.click();
      return;
    }

    await dialog.getByText(name, { exact: true }).click();
  }

  private async selectFirstSavedSearchComboboxOption(dialog: Locator, optionName: string) {
    await dialog.getByRole('combobox').first().click();
    await this.page.getByRole('option', { name: optionName }).click();
  }

  private async addSavedSearchKeyword(dialog: Locator, inputValue: string, optionName: string) {
    const keywordInput = dialog
      .getByRole('textbox', { name: /eg\. High ceilings, scenic|Add another/i })
      .filter({ visible: true })
      .last();

    await expect(keywordInput, 'Expected saved search keyword input to be visible.').toBeVisible();
    await keywordInput.fill(inputValue);
    await dialog
      .getByRole('button', { name: new RegExp(this.escapeRegExp(optionName), 'i') })
      .or(this.page.getByRole('button', { name: new RegExp(this.escapeRegExp(optionName), 'i') }))
      .first()
      .click();
  }

  private async clearSavedSearchKeywordsIfPresent(dialog: Locator) {
    const clearAllButton = dialog.getByRole('button', { name: /clear all/i }).first();

    if (await clearAllButton.isVisible().catch(() => false)) {
      await clearAllButton.click();
    }
  }

  private async saveSavedSearchEditDialog(dialog: Locator) {
    const saveButton = dialog
      .getByRole('button', { name: /^(Save changes|Save|Update|Done)$/i })
      .filter({ visible: true })
      .first();

    await expect(saveButton, 'Expected saved search edit dialog save/update button.').toBeEnabled();
    await saveButton.scrollIntoViewIfNeeded();
    await saveButton.click();
    await expect(dialog)
      .toBeHidden({ timeout: 20000 })
      .catch(async () => {
        if (await saveButton.isVisible().catch(() => false)) {
          await saveButton.click({ force: true });
        }

        await expect(dialog)
          .toBeHidden({ timeout: 5000 })
          .catch(async () => {
            await dialog.getByRole('button', { name: /close/i }).click();
            await expect(dialog).toBeHidden({ timeout: 20000 });
          });
      });
  }

  private async expectEmailFrequencyUpdatedToast() {
    const toastText = /Email frequency updated/i;
    const toast = this.page.locator('[data-sonner-toast]').filter({ hasText: toastText }).first();

    await expectToastVisibleOrRecorded(
      this.page,
      toast,
      toastText,
      'Expected email frequency update toast.',
    );
  }

  private savedSearchPriceLabelToInputValue(priceLabel: string) {
    const match = priceLabel.match(/^\$(\d+(?:\.\d+)?)([KM])$/i);

    expect(
      match,
      `Expected compact price label like "$1.2M", received "${priceLabel}".`,
    ).not.toBeNull();

    const amount = Number(match![1]);
    const multiplier = match![2]!.toUpperCase() === 'M' ? 1000000 : 1000;

    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(amount * multiplier);
  }

  private topSavedSearchCard() {
    return this.savedSearchCard(0);
  }

  private savedSearchCard(savedSearchIndex: number) {
    const savedSearchLink = this.savedSearchLink(savedSearchIndex);

    return savedSearchLink
      .locator('xpath=ancestor::*[.//a[contains(@href, "/dashboard/search?")] and .//button][1]')
      .first();
  }

  private topSavedSearchLink() {
    return this.savedSearchLink(0);
  }

  private savedSearchLink(savedSearchIndex: number) {
    return this.page
      .getByRole('tabpanel')
      .locator('a[href^="/dashboard/search?"]')
      .nth(savedSearchIndex);
  }

  private async selectOpenDropdownOption(optionName: string) {
    const option = this.page
      .getByRole('option', { name: new RegExp(`^${this.escapeRegExp(optionName)}$`, 'i') })
      .filter({ visible: true })
      .first();

    await expect(option, `Expected dropdown option "${optionName}" to be visible.`).toBeVisible();
    await option.click();
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

  private async scrollToSavedListingFolderLink(folderLink: Locator, folderNameText: string) {
    await this.page.evaluate(() => {
      window.scrollTo(0, 0);
      const scrollableElements = Array.from(document.querySelectorAll<HTMLElement>('*')).filter(
        (element) => element.scrollHeight > element.clientHeight + 2,
      );

      for (const element of scrollableElements) {
        element.scrollTop = 0;
      }
    });

    for (let attempt = 0; attempt < 7; attempt += 1) {
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

  private escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
