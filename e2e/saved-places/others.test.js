/**
 * Saved places — others
 *
 * Edge cases and flows not covered by happy/deep paths yet.
 */
const {launchToMap} = require('../helpers/launch-to-map');
const {
  assertSavedPlacesListEmpty,
  closeSavedPlacesList,
  deleteAllSavedPlaces,
  openSavedPlacesFromMap,
} = require('./helpers/saved-places-flow');
const M = require('./helpers/saved-places-matchers');

describe('Saved places others', () => {
  beforeAll(async () => {
    await launchToMap();
  });

  afterEach(async () => {
    await closeSavedPlacesList();
  });

  it('shows empty-state copy when the list has no saved places', async () => {
    await openSavedPlacesFromMap();
    await deleteAllSavedPlaces();
    await assertSavedPlacesListEmpty();
    await expect(
      element(by.text('Long-press anywhere on the map')),
    ).toBeVisible();
  });

  // Future: saved-place limit (20), long-press map save, duplicate home/work guards.
});
