import type { MomentRow } from '@/db/repositories/moments';
import { toDateKey } from '@/lib/day-utils';
import {
  loadAdjacentNewerDay,
  loadAdjacentOlderDay,
} from '@/lib/moments/gallery-moments-cache';

export type GalleryPreviewExpandEdge = 'start' | 'end';

export type GalleryPreviewExpandResult = {
  moments: MomentRow[];
  /** Apply to activeIndex when items were prepended. */
  indexDelta: number;
};

/**
 * Expand gallery preview toward older (`start`) or newer (`end`) days.
 * Moments are chronological ascending within the flat preview list.
 */
export async function expandGalleryPreviewMoments(
  current: MomentRow[],
  edge: GalleryPreviewExpandEdge,
): Promise<GalleryPreviewExpandResult | null> {
  if (current.length === 0) {
    return null;
  }

  if (edge === 'start') {
    const first = current[0]!;
    const adjacent = await loadAdjacentOlderDay(toDateKey(first.timestamp));
    if (!adjacent || adjacent.moments.length === 0) {
      return null;
    }
    const existingIds = new Set(current.map(m => m.id));
    const prepend = adjacent.moments.filter(m => !existingIds.has(m.id));
    if (prepend.length === 0) {
      return null;
    }
    return {
      moments: [...prepend, ...current],
      indexDelta: prepend.length,
    };
  }

  const last = current[current.length - 1]!;
  const adjacent = await loadAdjacentNewerDay(toDateKey(last.timestamp));
  if (!adjacent || adjacent.moments.length === 0) {
    return null;
  }
  const existingIds = new Set(current.map(m => m.id));
  const append = adjacent.moments.filter(m => !existingIds.has(m.id));
  if (append.length === 0) {
    return null;
  }
  return {
    moments: [...current, ...append],
    indexDelta: 0,
  };
}
