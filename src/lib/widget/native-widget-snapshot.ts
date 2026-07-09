import { NativeModules, Platform } from 'react-native';

import type { WidgetSnapshot } from './types';

type WidgetSnapshotNativeModule = {
  writeSnapshot: (json: string) => Promise<void>;
  reloadTimelines: () => Promise<void>;
  consumePendingAction: () => Promise<string | null>;
};

const nativeModule = NativeModules.WidgetSnapshotModule as
  | WidgetSnapshotNativeModule
  | undefined;

export async function writeWidgetSnapshot(
  snapshot: WidgetSnapshot,
): Promise<void> {
  if (Platform.OS !== 'ios' || nativeModule?.writeSnapshot == null) {
    return;
  }
  await nativeModule.writeSnapshot(JSON.stringify(snapshot));
}

export async function reloadWidgetTimelines(): Promise<void> {
  if (Platform.OS !== 'ios' || nativeModule?.reloadTimelines == null) {
    return;
  }
  await nativeModule.reloadTimelines();
}

export async function consumePendingWidgetAction(): Promise<string | null> {
  if (Platform.OS !== 'ios' || nativeModule?.consumePendingAction == null) {
    return null;
  }
  const action = await nativeModule.consumePendingAction();
  return action ?? null;
}
