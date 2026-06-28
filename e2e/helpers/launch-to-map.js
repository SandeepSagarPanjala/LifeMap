const SYSTEM_ALERT_LABELS = [
  'Allow While Using App',
  'Allow Once',
  'While using the app',
  'Allow',
  'OK',
  'Don\u2019t Allow',
];

async function tapIfVisible(matcher, timeoutMs = 3000) {
  try {
    await waitFor(matcher).toBeVisible().withTimeout(timeoutMs);
    await matcher.tap();
    return true;
  } catch {
    return false;
  }
}

async function dismissSystemAlerts() {
  for (const label of SYSTEM_ALERT_LABELS) {
    await tapIfVisible(element(by.label(label)), 1000);
  }
}

/** Fresh launch through splash, onboarding, and optional restore offer to the map. */
async function launchToMap(options = {}) {
  await device.launchApp({
    newInstance: true,
    delete: true,
    permissions: {
      location: 'always',
      motion: 'YES',
      camera: 'YES',
      microphone: 'YES',
      notifications: 'YES',
      photos: 'YES',
    },
    ...options,
  });

  await tapIfVisible(element(by.label('Skip onboarding')), 20000);
  await dismissSystemAlerts();

  await tapIfVisible(element(by.text('Start fresh')), 8000);

  await waitFor(element(by.label('Saved places')))
    .toBeVisible()
    .withTimeout(45000);
}

module.exports = {
  dismissSystemAlerts,
  launchToMap,
};
