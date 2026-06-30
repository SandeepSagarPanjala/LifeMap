const {launchToMap} = require('./helpers/launch-to-map');

describe('Smoke', () => {
  beforeAll(async () => {
    await launchToMap();
  });

  it('shows map capture controls on today', async () => {
    await expect(element(by.label('Open saved places'))).toBeVisible();
    await expect(element(by.label('Log an activity'))).toBeVisible();
    await expect(element(by.label('Take a photo'))).toBeVisible();
  });
});
