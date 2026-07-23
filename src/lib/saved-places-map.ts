import type { SavedPlaceKind } from '@/db/repositories/saved-places';
import {
  SAVED_PLACE_CIRCLE_MAX_ZOOM_DELTA,
  SAVED_PLACE_DETAILED_MAX_ZOOM_DELTA,
  SAVED_PLACE_MAP_STYLE as SAVED_PLACE_MAP_STYLE_VALUES,
} from '@/lib/app-constants';

export const SAVED_PLACE_MAP_STYLE: Record<
  SavedPlaceKind,
  { fill: string; stroke: string; badgeBg: string; icon: string }
> = SAVED_PLACE_MAP_STYLE_VALUES;

export function shouldShowSavedPlaceCircles(latitudeDelta: number): boolean {
  return latitudeDelta <= SAVED_PLACE_CIRCLE_MAX_ZOOM_DELTA;
}

/**
 * Favorite/work become simple colored dots when zoomed out past default.
 * Home always keeps the detailed icon + label marker.
 */
export function shouldShowSavedPlaceAsDot(
  kind: SavedPlaceKind,
  latitudeDelta: number,
): boolean {
  if (kind === 'home') {
    return false;
  }
  return latitudeDelta > SAVED_PLACE_DETAILED_MAX_ZOOM_DELTA;
}
