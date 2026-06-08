import {Briefcase, Heart, Home} from 'lucide-react-native';

import type {SavedPlaceKind} from '@/db/repositories/saved-places';
import {HISTORY_COLORS} from '@/lib/history-timeline';

type SavedPlaceIconProps = {
  kind: SavedPlaceKind;
  size?: number;
  color?: string;
};

export function SavedPlaceIcon({
  kind,
  size = 16,
  color = HISTORY_COLORS.stay,
}: SavedPlaceIconProps) {
  if (kind === 'home') {
    return <Home size={size} color={color} strokeWidth={2.25} />;
  }
  if (kind === 'work') {
    return <Briefcase size={size} color={color} strokeWidth={2.25} />;
  }
  return <Heart size={size} color={color} strokeWidth={2.25} fill={color} />;
}
