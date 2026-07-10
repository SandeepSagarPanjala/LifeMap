import type { HistoryData } from '@/lib/history-data-types';

/** Whether two history snapshots would paint the same map / timeline. */
export function historyDataDisplayEqual(
  previous: HistoryData,
  next: HistoryData,
): boolean {
  if (previous === next) {
    return true;
  }
  if (previous.dateKey !== next.dateKey) {
    return false;
  }
  if (previous.points.length !== next.points.length) {
    return false;
  }
  if (previous.entries.length !== next.entries.length) {
    return false;
  }
  if (previous.range.startAt.getTime() !== next.range.startAt.getTime()) {
    return false;
  }
  if (previous.range.endAt.getTime() !== next.range.endAt.getTime()) {
    return false;
  }
  for (let index = 0; index < previous.entries.length; index += 1) {
    const left = previous.entries[index];
    const right = next.entries[index];
    if (left.id !== right.id || left.kind !== right.kind) {
      return false;
    }
    if (left.endAt.getTime() !== right.endAt.getTime()) {
      return false;
    }
    if (left.openThroughNow !== right.openThroughNow) {
      return false;
    }
  }
  if (previous.points.length > 0) {
    const leftLast = previous.points[previous.points.length - 1];
    const rightLast = next.points[next.points.length - 1];
    if (leftLast.recordedAtMs !== rightLast.recordedAtMs) {
      return false;
    }
  }
  return true;
}
