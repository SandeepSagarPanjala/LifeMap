export const HEALTHKIT_IMPORT_SOURCE = 'healthkit';

export const SETTINGS_KEY_HEALTHKIT_MASTER = 'healthkit_master';
export const SETTINGS_KEY_HEALTHKIT_SLEEP = 'healthkit_sleep';
export const SETTINGS_KEY_HEALTHKIT_ACTIVITY = 'healthkit_activity';
export const SETTINGS_KEY_HEALTHKIT_STEPS = 'healthkit_steps';

/** Minimum overlap between a stay and a sleep session to show on the visit card. */
export const SLEEP_STAY_MIN_OVERLAP_MS = 30 * 60_000;

/** Gap under which adjacent asleep samples merge into one session. */
export const SLEEP_MERGE_GAP_MS = 45 * 60_000;
