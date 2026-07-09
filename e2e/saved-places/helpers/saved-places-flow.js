const M = require('./saved-places-matchers');

async function isVisible(matcher, timeoutMs = 1500) {
  try {
    await waitFor(matcher).toBeVisible().withTimeout(timeoutMs);
    return true;
  } catch {
    return false;
  }
}

async function isOnSavedPlacesList() {
  return isVisible(element(by.text(M.LIST_HEADING)), 500);
}

async function isAddByAddressFormOpen() {
  return isVisible(element(by.label(M.CANCEL_ADD)), 500);
}

/** Map → Saved places list (half sheet). */
async function openSavedPlacesFromMap() {
  await device.disableSynchronization();
  try {
    await element(by.label(M.MAP_PIN)).tap();
    await waitFor(element(by.text(M.LIST_HEADING)))
      .toBeVisible()
      .withTimeout(20000);
    await waitFor(element(by.text(M.ADD_BY_ADDRESS)))
      .toBeVisible()
      .withTimeout(20000);
  } finally {
    await device.enableSynchronization();
  }
}

/** Back to map from the list (no gorhom overlays open). */
async function closeSavedPlacesList() {
  if (await isAddByAddressFormOpen()) {
    await element(by.label(M.CANCEL_ADD)).tap();
    await waitFor(element(by.label(M.CANCEL_ADD)))
      .not.toBeVisible()
      .withTimeout(10000);
  }
  if (await isVisible(element(by.label(M.RENAMED_FAVORITE_NAME)), 500)) {
    await element(by.label(M.CANCEL_RENAME)).tap();
    await waitFor(element(by.label(M.RENAMED_FAVORITE_NAME)))
      .not.toBeVisible()
      .withTimeout(10000);
  }
  if (!(await isOnSavedPlacesList())) {
    return;
  }
  await device.disableSynchronization();
  try {
    const dismiss = element(by.label(M.DISMISS_SHEET));
    await dismiss.tap({ x: 24, y: 120 });
    try {
      await waitFor(element(by.text(M.LIST_HEADING)))
        .not.toBeVisible()
        .withTimeout(8000);
    } catch {
      await dismiss.tap({ x: 24, y: 120 });
      await waitFor(element(by.text(M.LIST_HEADING)))
        .not.toBeVisible()
        .withTimeout(10000);
    }
  } finally {
    await device.enableSynchronization();
  }
}

/**
 * Return to the list from add-by-address or rename overlays.
 * If already on the map, opens the list.
 */
async function ensureSavedPlacesList() {
  if (await isAddByAddressFormOpen()) {
    await element(by.label(M.CANCEL_ADD)).tap();
    await waitFor(element(by.label(M.CANCEL_ADD)))
      .not.toBeVisible()
      .withTimeout(10000);
  }
  if (await isVisible(element(by.label(M.RENAMED_FAVORITE_NAME)), 500)) {
    await element(by.label(M.CANCEL_RENAME)).tap();
    await waitFor(element(by.label(M.RENAMED_FAVORITE_NAME)))
      .not.toBeVisible()
      .withTimeout(10000);
  }
  if (await isOnSavedPlacesList()) {
    return;
  }
  await openSavedPlacesFromMap();
}

async function tapAddByAddressLink() {
  const link = element(by.label(M.ADD_BY_ADDRESS_LINK));
  if (!(await isVisible(link, 1500))) {
    await swipeSavedPlacesList('up');
  }
  await waitFor(link).toBeVisible().withTimeout(15000);
  await link.tap();
}

/** List → add-by-address form. */
async function openAddByAddressForm() {
  await ensureSavedPlacesList();

  await waitFor(element(by.label(M.CANCEL_ADD)))
    .not.toBeVisible()
    .withTimeout(15000);

  if (!(await isAddByAddressFormOpen())) {
    await tapAddByAddressLink();
  }

  await device.disableSynchronization();
  try {
    if (!(await isAddByAddressFormOpen())) {
      await tapAddByAddressLink();
    }
    await waitFor(element(by.label(M.CANCEL_ADD)))
      .toBeVisible()
      .withTimeout(30000);
    await waitFor(element(by.label(M.ADDRESS_FIELD)))
      .toBeVisible()
      .withTimeout(10000);
  } finally {
    await device.enableSynchronization();
  }
}

async function advancePastAddressLookup(kind) {
  await device.disableSynchronization();
  try {
    if (
      await isVisible(element(by.label('Continue with selected address')), 2000)
    ) {
      await element(by.label(/^Select /))
        .atIndex(0)
        .tap();
      await element(by.label('Continue with selected address')).tap();
    }

    if (kind === 'home') {
      await waitFor(element(by.label(M.MARK_AS_HOME)))
        .toBeVisible()
        .withTimeout(15000);
      return;
    }

    if (kind === 'work') {
      await waitFor(element(by.label(M.MARK_AS_WORK)))
        .toBeVisible()
        .withTimeout(15000);
      return;
    }

    // Favorite: tap "Add Favorite" when Home/Work slots are still open; otherwise name field only.
    if (await isVisible(element(by.label(M.ADD_FAVORITE_KIND)), 1500)) {
      await element(by.label(M.ADD_FAVORITE_KIND)).tap();
    }
    await waitFor(element(by.label(M.NEW_FAVORITE_NAME)))
      .toBeVisible()
      .withTimeout(10000);
  } finally {
    await device.enableSynchronization();
  }
}

async function assertSavedPlacesListEmpty() {
  await waitFor(element(by.text(M.LIST_HEADING)))
    .toBeVisible()
    .withTimeout(5000);
  if (await hasAnySavedPlace()) {
    throw new Error('Expected empty saved places list');
  }
  await waitFor(element(by.text(M.ADD_BY_ADDRESS)))
    .toBeVisible()
    .withTimeout(5000);
}

async function fillAddressAndLookup(address, kind) {
  const addressField = element(by.label(M.ADDRESS_FIELD));
  await addressField.tap();
  await addressField.replaceText(address);
  await element(by.label(M.LOOKUP_ADDRESS)).tap();
  await advancePastAddressLookup(kind);
}

async function savePlaceKind(kind, favoriteLabel) {
  if (kind === 'home') {
    await waitFor(element(by.label(M.MARK_AS_HOME)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.label(M.MARK_AS_HOME)).tap();
  } else if (kind === 'work') {
    await waitFor(element(by.label(M.MARK_AS_WORK)))
      .toBeVisible()
      .withTimeout(10000);
    await element(by.label(M.MARK_AS_WORK)).tap();
  } else if (await isVisible(element(by.label(M.ADD_FAVORITE_KIND)), 1500)) {
    await element(by.label(M.ADD_FAVORITE_KIND)).tap();
  }

  if (kind === 'favorite') {
    const nameField = element(by.label(M.NEW_FAVORITE_NAME));
    await nameField.tap();
    await nameField.replaceText(favoriteLabel);
  }

  await waitFor(element(by.label(M.SAVE_BY_ADDRESS)))
    .toBeVisible()
    .withTimeout(5000);
  await element(by.label(M.SAVE_BY_ADDRESS)).tap();

  await device.disableSynchronization();
  try {
    await waitFor(element(by.label(M.CANCEL_ADD)))
      .not.toBeVisible()
      .withTimeout(20000);
  } finally {
    await device.enableSynchronization();
  }
}

/**
 * Add Home, Work, or Favorite via add-by-address.
 * @param {'home'|'work'|'favorite'} kind
 */
async function addPlaceByAddress(kind, { address, favoriteLabel } = {}) {
  const resolvedAddress =
    address ??
    (kind === 'home'
      ? M.GEOCODE_HOME
      : kind === 'work'
      ? M.GEOCODE_WORK
      : M.GEOCODE_FAVORITE);

  if (kind === 'favorite' && !favoriteLabel) {
    throw new Error('favoriteLabel is required when kind is favorite');
  }

  await openAddByAddressForm();
  await fillAddressAndLookup(resolvedAddress, kind);
  await savePlaceKind(kind, favoriteLabel);

  const expectedLabel =
    kind === 'home'
      ? M.HOME_LABEL
      : kind === 'work'
      ? M.WORK_LABEL
      : favoriteLabel;
  await waitFor(element(by.label(`Show ${expectedLabel} on map`)))
    .toBeVisible()
    .withTimeout(10000);
}

/** Full add-favorite-by-address flow; leaves the list showing `label`. */
async function addFavoriteByAddress(label, address = M.GEOCODE_FAVORITE) {
  await addPlaceByAddress('favorite', { address, favoriteLabel: label });
}

async function hasSavedPlaceRows() {
  return isVisible(element(by.text(M.LIST_HAS_ROWS_HINT)), 500);
}

async function hasAnySavedPlace() {
  return (
    (await hasSavedPlaceRows()) ||
    (await findVisibleRowLabelFromShowButton()) != null ||
    (await hasVisibleRemoveButton())
  );
}

/** Row title from the first visible "Show … on map" control (skips stale nodes). */
async function findVisibleRowLabelFromShowButton(maxIndex = 12) {
  for (let i = 0; i < maxIndex; i += 1) {
    const showButton = element(by.label(/^Show .+ on map$/)).atIndex(i);
    if (await isVisible(showButton, 300)) {
      const { label: showLabel } = await showButton.getAttributes();
      return showLabel.replace(/^Show /, '').replace(/ on map$/, '');
    }
  }
  return null;
}

/**
 * Detox keeps stale Remove nodes after a row unmounts; atIndex(0) can point at a
 * hidden Home/Work button while Favorite is the only visible row.
 */
async function findVisibleRemoveButton(maxIndex = 12) {
  for (let i = 0; i < maxIndex; i += 1) {
    const removeButton = element(by.label(/^Remove /)).atIndex(i);
    if (await isVisible(removeButton, 300)) {
      return removeButton;
    }
  }
  return null;
}

async function hasVisibleRemoveButton() {
  return (await findVisibleRemoveButton()) != null;
}

async function placeLabelFromRemoveButton(removeButton) {
  const { label: removeLabel } = await removeButton.getAttributes();
  return removeLabel.replace(/^Remove /, '');
}

/** Swipe inside the saved-places sheet list — never UIScrollView atIndex(0) (that is often the map). */
async function swipeSavedPlacesList(direction = 'up', speed = 'slow') {
  try {
    await element(by.text(M.LIST_HEADING)).swipe(direction, speed, 0.25);
  } catch {
    // ignore
  }
}

/** Scroll until a remove control is on screen (long lists only). */
async function waitForRemoveButton(label) {
  if (label != null) {
    const removeButton = element(by.label(`Remove ${label}`));
    if (await isVisible(removeButton, 1500)) {
      return removeButton;
    }
    await swipeSavedPlacesList('up');
    await waitFor(removeButton).toBeVisible().withTimeout(8000);
    return removeButton;
  }

  let removeButton = await findVisibleRemoveButton();
  if (removeButton) {
    return removeButton;
  }

  await swipeSavedPlacesList('up');
  removeButton = await findVisibleRemoveButton();
  if (removeButton) {
    return removeButton;
  }

  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    removeButton = await findVisibleRemoveButton();
    if (removeButton) {
      return removeButton;
    }
  }

  await waitFor(element(by.label(/^Remove /)).atIndex(0))
    .toBeVisible()
    .withTimeout(1000);
  return element(by.label(/^Remove /)).atIndex(0);
}

/**
 * Confirm the delete alert from SavedPlacesSheet.confirmDelete.
 * Buttons are always Cancel + Remove (see SavedPlacesSheet.tsx).
 */
async function confirmRemoveAlert(placeLabel) {
  const alertTitle = element(by.text(M.alertRemoveTitle(placeLabel)));
  await waitFor(alertTitle).toBeVisible().withTimeout(10000);
  await waitFor(element(by.text(M.ALERT_REMOVE_MESSAGE)))
    .toBeVisible()
    .withTimeout(5000);

  await element(
    by.label(M.ALERT_REMOVE).and(by.type('_UIAlertControllerActionView')),
  ).tap();

  await waitFor(alertTitle).not.toBeVisible().withTimeout(15000);
}

async function deletePlaceByLabel(label) {
  await ensureSavedPlacesList();
  const removeButton = await waitForRemoveButton(label);
  await device.disableSynchronization();
  try {
    await removeButton.tap();
  } finally {
    await device.enableSynchronization();
  }
  await confirmRemoveAlert(label);
  await waitFor(element(by.text(label)))
    .not.toBeVisible()
    .withTimeout(10000);
}

async function deleteFavorite(label) {
  await deletePlaceByLabel(label);
}

async function tapRemoveAndConfirm(removeButton, placeLabel) {
  await device.disableSynchronization();
  try {
    await removeButton.tap();
  } finally {
    await device.enableSynchronization();
  }
  await confirmRemoveAlert(placeLabel);
}

/** Tap the first visible trash icon on the list, confirm alert. */
async function deleteFirstSavedPlaceIfVisible() {
  for (const label of [M.HOME_LABEL, M.WORK_LABEL]) {
    const removeButton = element(by.label(`Remove ${label}`));
    if (await isVisible(removeButton, 800)) {
      await tapRemoveAndConfirm(removeButton, label);
      return true;
    }
  }

  const rowLabel = await findVisibleRowLabelFromShowButton();
  if (rowLabel) {
    const removeButton = element(by.label(`Remove ${rowLabel}`));
    try {
      await waitFor(removeButton).toBeVisible().withTimeout(5000);
      await tapRemoveAndConfirm(removeButton, rowLabel);
      return true;
    } catch {
      // fall through to generic trash scan
    }
  }

  let removeButton = await findVisibleRemoveButton();
  if (!removeButton) {
    await swipeSavedPlacesList('up');
    removeButton = await findVisibleRemoveButton();
  }
  if (!removeButton) {
    return false;
  }

  const placeLabel = await placeLabelFromRemoveButton(removeButton);
  await tapRemoveAndConfirm(removeButton, placeLabel);
  return true;
}

/** Remove every saved place currently shown in the list. */
async function deleteAllSavedPlaces() {
  await ensureSavedPlacesList();

  for (let attempt = 0; attempt < 25; attempt += 1) {
    if (!(await hasAnySavedPlace())) {
      return;
    }

    const deleted = await deleteFirstSavedPlaceIfVisible();
    if (!deleted) {
      if (await isOnSavedPlacesList()) {
        throw new Error(
          'Could not find a delete button on the saved places list',
        );
      }
      return;
    }
  }

  if (await hasAnySavedPlace()) {
    throw new Error('Could not delete all saved places — list still has rows');
  }
}

/** Open the list and delete all rows only when the sheet is not empty. */
async function deleteAllSavedPlacesIfAny() {
  await ensureSavedPlacesList();
  if (!(await hasAnySavedPlace())) {
    return;
  }
  await deleteAllSavedPlaces();
}

async function waitForRenameButton(label) {
  const renameButton = element(by.label(`Rename ${label}`));

  if (await isVisible(renameButton, 1500)) {
    return renameButton;
  }

  await swipeSavedPlacesList('up');
  await waitFor(renameButton).toBeVisible().withTimeout(10000);
  return renameButton;
}

async function renameFavorite(currentLabel, newLabel) {
  await ensureSavedPlacesList();
  const renameButton = await waitForRenameButton(currentLabel);
  await renameButton.tap();

  await device.disableSynchronization();
  try {
    await waitFor(element(by.label(M.RENAMED_FAVORITE_NAME)))
      .toBeVisible()
      .withTimeout(15000);
  } finally {
    await device.enableSynchronization();
  }

  const nameField = element(by.label(M.RENAMED_FAVORITE_NAME));
  await nameField.replaceText(newLabel);
  await element(by.label(M.SAVE_RENAME)).tap();

  await waitFor(element(by.text(newLabel)))
    .toBeVisible()
    .withTimeout(10000);
}

module.exports = {
  addFavoriteByAddress,
  addPlaceByAddress,
  assertSavedPlacesListEmpty,
  closeSavedPlacesList,
  deleteAllSavedPlaces,
  deleteAllSavedPlacesIfAny,
  deleteFavorite,
  deletePlaceByLabel,
  ensureSavedPlacesList,
  openAddByAddressForm,
  openSavedPlacesFromMap,
  renameFavorite,
};
