const SYSTEM_ALERT_LABELS = [
  'Allow While Using App',
  'Allow Once',
  'While using the app',
  'Allow',
  'OK',
  'Don\u2019t Allow',
];

/** How long to poll for an optional overlay before trying the next step. */
const OPTIONAL_STEP_MS = 800;

/** Total budget from launch until the map pin must be visible. */
const MAP_READY_MS = 45000;

async function isVisible(matcher, timeoutMs = OPTIONAL_STEP_MS) {
  try {
    await waitFor(matcher).toBeVisible().withTimeout(timeoutMs);
    return true;
  } catch {
    return false;
  }
}

async function tapIfVisible(matcher, timeoutMs = OPTIONAL_STEP_MS) {
  if (!(await isVisible(matcher, timeoutMs))) {
    return false;
  }
  await matcher.tap();
  return true;
}

async function dismissSystemAlerts() {
  for (const label of SYSTEM_ALERT_LABELS) {
    await tapIfVisible(element(by.label(label)), 400);
  }
}

const MAP_PIN = element(by.label('Open saved places'));

/**
 * Launch or focus the app on the map.
 * Polls with short optional-step timeouts — does not block 20s when onboarding is absent.
 */
async function launchToMap(options = {}) {
  await device.launchApp({
    permissions: {
      location: 'always',
      motion: 'YES',
      camera: 'YES',
      microphone: 'YES',
      notifications: 'YES',
      photos: 'YES',
    },
    newInstance: false,
    delete: false,
    ...options,
  });

  const deadline = Date.now() + MAP_READY_MS;
  while (Date.now() < deadline) {
    if (await isVisible(MAP_PIN, OPTIONAL_STEP_MS)) {
      return;
    }
    await tapIfVisible(element(by.label('Skip onboarding')));
    await dismissSystemAlerts();
    await tapIfVisible(element(by.text('Start fresh')));
  }

  await waitFor(MAP_PIN).toBeVisible().withTimeout(5000);
}

module.exports = {
  dismissSystemAlerts,
  launchToMap,
};
