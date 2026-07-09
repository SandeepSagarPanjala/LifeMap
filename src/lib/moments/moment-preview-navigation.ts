import type { MomentRow } from '@/db/repositories/moments';
import type { DayTimelineEntry } from '@/lib/trip-detection';

export type MomentPreviewPayload = {
  moments: MomentRow[];
  initialIndex: number;
  previewEntry?: DayTimelineEntry | null;
  dateKey: string;
};

let pendingPreview: MomentPreviewPayload | null = null;

export function queueMomentPreview(payload: MomentPreviewPayload): void {
  pendingPreview = payload;
}

export function consumeMomentPreview(): MomentPreviewPayload | null {
  const payload = pendingPreview;
  pendingPreview = null;
  return payload;
}
