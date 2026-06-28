/**
 * Saved places — deep path
 *
 * Open list → clear existing (if any) → Home → Work → Favorite → rename Favorite → clear all.
 * Requires network for geocoding.
 */
const {launchToMap} = require('../helpers/launch-to-map');
const M = require('./helpers/saved-places-matchers');
const {
  addPlaceByAddress,
  assertSavedPlacesListEmpty,
  closeSavedPlacesList,
  deleteAllSavedPlaces,
  deleteAllSavedPlacesIfAny,
  openSavedPlacesFromMap,
  renameFavorite,
} = require('./helpers/saved-places-flow');

describe('Saved places deep path', () => {
  beforeAll(async () => {
    await launchToMap();
  });

  afterEach(async () => {
    await closeSavedPlacesList();
  });

  it(
    'clears existing if any, adds Home Work and Favorite, renames Favorite, then clears again',
    async () => {
      const favoriteLabel = `E2E Deep Fav ${Date.now()}`;
      const renamedLabel = `${favoriteLabel} X`;

      await openSavedPlacesFromMap();
      await deleteAllSavedPlacesIfAny();

      await addPlaceByAddress('home', {address: M.GEOCODE_HOME});
      await expect(element(by.text(M.HOME_LABEL))).toBeVisible();

      await addPlaceByAddress('work', {address: M.GEOCODE_WORK});
      await expect(element(by.text(M.WORK_LABEL))).toBeVisible();

      await addPlaceByAddress('favorite', {
        address: M.GEOCODE_FAVORITE,
        favoriteLabel,
      });
      await expect(element(by.text(favoriteLabel))).toBeVisible();

      await renameFavorite(favoriteLabel, renamedLabel);
      await expect(element(by.text(renamedLabel))).toBeVisible();

      await deleteAllSavedPlaces();
      await assertSavedPlacesListEmpty();
    },
    300000,
  );
});
