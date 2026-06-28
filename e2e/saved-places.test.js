const {launchToMap} = require('./helpers/launch-to-map');

describe('Saved places', () => {
  beforeAll(async () => {
    await launchToMap();
  });

  it('opens the saved places sheet from the map pin', async () => {
    await element(by.label('Saved places')).tap();
    await waitFor(element(by.text('Saved places')))
      .toBeVisible()
      .withTimeout(10000);
  });
});
