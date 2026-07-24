import type { MomentRow } from '@/db/repositories/moments';
import type { DayTimelineEntry } from '@/lib/trip-detection';
import {
  expandGalleryPreviewMoments,
  type GalleryPreviewExpandEdge,
  type GalleryPreviewExpandResult,
} from '@/lib/moments/gallery-preview-expand';

export type MomentPreviewPayload = {
  moments: MomentRow[];
  initialIndex: number;
  previewEntry?: DayTimelineEntry | null;
  dateKey: string;
  /** When true, preview can expand across adjacent gallery days at edges. */
  crossDayExpand?: boolean;
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

export async function expandMomentPreviewIfNeeded(
  current: MomentRow[],
  edge: GalleryPreviewExpandEdge,
  enabled: boolean,
): Promise<GalleryPreviewExpandResult | null> {
  if (!enabled) {
    return null;
  }
  return expandGalleryPreviewMoments(current, edge);
}
