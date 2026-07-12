import Svg, { Path } from 'react-native-svg';

import { poiCategoryLucideIcon } from '@/lib/poi-category-icon';

type VisitPlaceKindIconProps = {
  pinned: boolean;
  category?: string | null;
  size?: number;
  color?: string;
};

const LIGHT_FILL = '#C7C7CC';

/** Building2 with light body fill + stroke windows/door (fill alone hides details). */
function AddressBuildingIcon({
  size,
  color,
}: {
  size: number;
  color: string;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Side wing */}
      <Path
        d="M6 10H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-2"
        fill={LIGHT_FILL}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Main tower */}
      <Path
        d="M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"
        fill={LIGHT_FILL}
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Windows */}
      <Path
        d="M10 8h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M10 12h4"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Door arch */}
      <Path
        d="M14 21v-3a2 2 0 0 0-4 0v3"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/**
 * Place-name glyph: Building2 (address), category Lucide (POI), MapPin fallback.
 * POI icons use Lucide stroke + light fill (same treatment as MapPin).
 */
export function VisitPlaceKindIcon({
  pinned,
  category = null,
  size = 14,
  color = '#8E8E93',
}: VisitPlaceKindIconProps) {
  if (!pinned) {
    return <AddressBuildingIcon size={size} color={color} />;
  }

  const Icon = poiCategoryLucideIcon(category);
  return (
    <Icon size={size} color={color} fill={LIGHT_FILL} strokeWidth={2} />
  );
}
