import { getSetting, setSetting } from '@/db/repositories/settings';
import {
  DEFAULT_ON_FOOT_DETECTION_ENABLED,
  SETTINGS_KEY_ON_FOOT_DETECTION_ENABLED,
} from '@/lib/app-constants';

let cachedEnabled = DEFAULT_ON_FOOT_DETECTION_ENABLED;
let hydrated = false;

const listeners = new Set<(enabled: boolean) => void>();

export function getOnFootDetectionEnabledSync(): boolean {
  return cachedEnabled;
}

export function subscribeOnFootDetectionEnabled(
  listener: (enabled: boolean) => void,
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyOnFootDetectionEnabled(enabled: boolean): void {
  for (const listener of listeners) {
    listener(enabled);
  }
}

export function normalizeOnFootDetectionEnabled(raw: string | null): boolean {
  if (raw === null) {
    return DEFAULT_ON_FOOT_DETECTION_ENABLED;
  }
  return raw === 'true';
}

export async function hydrateOnFootDetectionSetting(): Promise<boolean> {
  const raw = await getSetting(SETTINGS_KEY_ON_FOOT_DETECTION_ENABLED);
  const next = normalizeOnFootDetectionEnabled(raw);
  const changed = !hydrated || next !== cachedEnabled;
  cachedEnabled = next;
  hydrated = true;
  if (changed) {
    notifyOnFootDetectionEnabled(cachedEnabled);
  }
  return cachedEnabled;
}

export async function getOnFootDetectionEnabled(): Promise<boolean> {
  if (!hydrated) {
    return hydrateOnFootDetectionSetting();
  }
  return cachedEnabled;
}

export async function setOnFootDetectionEnabled(enabled: boolean): Promise<void> {
  await setSetting(
    SETTINGS_KEY_ON_FOOT_DETECTION_ENABLED,
    enabled ? 'true' : 'false',
  );
  cachedEnabled = enabled;
  hydrated = true;
  notifyOnFootDetectionEnabled(enabled);
}
