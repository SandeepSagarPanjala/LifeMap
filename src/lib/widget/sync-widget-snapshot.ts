import {ensureDatabaseReady} from '@/location/bootstrap';

import {buildWidgetSnapshot} from './build-widget-snapshot';
import {reloadWidgetTimelines, writeWidgetSnapshot} from './native-widget-snapshot';
import type {WidgetSnapshot} from './types';

const MIN_WIDGET_REFRESH_MS = 60_000;
let lastWidgetRefreshMs = 0;

export async function refreshWidgetSnapshot(now: Date = new Date()): Promise<WidgetSnapshot> {
  await ensureDatabaseReady();
  const snapshot = await buildWidgetSnapshot(now);
  await writeWidgetSnapshot(snapshot);
  await reloadWidgetTimelines();
  lastWidgetRefreshMs = now.getTime();
  return snapshot;
}

export async function refreshWidgetSnapshotIfStale(
  now: Date = new Date(),
  minIntervalMs: number = MIN_WIDGET_REFRESH_MS,
): Promise<WidgetSnapshot | null> {
  if (now.getTime() - lastWidgetRefreshMs < minIntervalMs) {
    return null;
  }
  return refreshWidgetSnapshot(now);
}
