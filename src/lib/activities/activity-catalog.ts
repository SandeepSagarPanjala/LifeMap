import { ACTIVITY_SCHEMA_VERSION } from '@/lib/activities/activity-definition';

/**
 * Remote catalog of portable activity YAML definitions.
 * Update this file (or point the URL at your website) without shipping packs in the app binary.
 */
export const ACTIVITY_CATALOG_URL =
  'https://raw.githubusercontent.com/SandeepSagarPanjala/LifeMap/main/catalog/activities.yaml';

export const ACTIVITY_CATALOG_FETCH_TIMEOUT_MS = 15_000;

export { ACTIVITY_SCHEMA_VERSION };
