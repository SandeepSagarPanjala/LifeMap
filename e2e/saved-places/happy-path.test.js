/**
 * Saved places — happy path
 *
 * Fast smoke coverage: open list, add/rename/delete one favorite by address.
 */
const { launchToMap } = require('../helpers/launch-to-map');
const M = require('./helpers/saved-places-matchers');
const {
  addFavoriteByAddress,
  closeSavedPlacesList,
  deleteFavorite,
  ensureSavedPlacesList,
  openSavedPlacesFromMap,
  renameFavorite,
} = require('./helpers/saved-places-flow');

describe('Saved places happy path', () => {
  beforeAll(async () => {
    await launchToMap();
  });

  afterEach(async () => {
    await closeSavedPlacesList();
  });

  it('opens the list from the map pin', async () => {
    await openSavedPlacesFromMap();
    await expect(element(by.text(M.LIST_HEADING))).toBeVisible();
    await expect(element(by.text(M.ADD_BY_ADDRESS))).toBeVisible();
  });

  it('adds, renames, and deletes a favorite by address', async () => {
    const label = `E2E Fav ${Date.now()}`;
    const renamed = `${label} X`;

    await addFavoriteByAddress(label);

    await ensureSavedPlacesList();
    await expect(element(by.text(label))).toBeVisible();
    await expect(element(by.label(`Show ${label} on map`))).toBeVisible();

    await renameFavorite(label, renamed);
    await expect(element(by.text(renamed))).toBeVisible();

    await deleteFavorite(renamed);
  }, 180000);
});
