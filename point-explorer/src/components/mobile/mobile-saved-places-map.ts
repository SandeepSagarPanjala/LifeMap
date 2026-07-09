import type { SavedPlaceRow } from '../../types';

export const SAVED_PLACE_MAP_STYLE: Record<
  SavedPlaceRow['kind'],
  { badgeBg: string; stroke: string; icon: string }
> = {
  home: {
    badgeBg: '#FFF8EE',
    stroke: 'rgba(255, 149, 0, 0.22)',
    icon: '#FF9500',
  },
  work: {
    badgeBg: '#F2F8FF',
    stroke: 'rgba(0, 122, 255, 0.22)',
    icon: '#007AFF',
  },
  favorite: {
    badgeBg: '#FFF5F7',
    stroke: 'rgba(255, 55, 95, 0.22)',
    icon: '#FF375F',
  },
};

export function savedPlaceDisplayLabel(place: SavedPlaceRow): string {
  return place.label.trim() || place.kind;
}
