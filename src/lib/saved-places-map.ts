import type {SavedPlaceKind} from '@/db/repositories/saved-places';

/** Hide 150 m circles when zoomed out beyond ~1.3 km span. */
export const SAVED_PLACE_CIRCLE_MAX_ZOOM_DELTA = 0.012;

export const SAVED_PLACE_MAP_STYLE: Record<
  SavedPlaceKind,
  {fill: string; stroke: string; badgeBg: string; icon: string}
> = {
  home: {
    fill: 'rgba(255, 149, 0, 0.07)',
    stroke: 'rgba(255, 149, 0, 0.22)',
    badgeBg: '#FFF8EE',
    icon: '#FF9500',
  },
  work: {
    fill: 'rgba(0, 122, 255, 0.07)',
    stroke: 'rgba(0, 122, 255, 0.22)',
    badgeBg: '#F2F8FF',
    icon: '#007AFF',
  },
  favorite: {
    fill: 'rgba(255, 55, 95, 0.07)',
    stroke: 'rgba(255, 55, 95, 0.22)',
    badgeBg: '#FFF5F7',
    icon: '#FF375F',
  },
};

export function shouldShowSavedPlaceCircles(latitudeDelta: number): boolean {
  return latitudeDelta <= SAVED_PLACE_CIRCLE_MAX_ZOOM_DELTA;
}
