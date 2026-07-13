/**
 * Fixed palette for day-story visit numbers + inbound drives.
 * Visit N always maps to the same color on every day (not random, not per-day).
 * Index = (visitNumber - 1) % length; cycles only after 52 stops in one day.
 */
export const DAY_STORY_VISIT_COLORS = [
  '#007AFF', // blue
  '#FF2D55', // pink/red
  '#34C759', // green
  '#AF52DE', // purple
  '#FF9500', // orange
  '#5AC8FA', // light blue
  '#FFCC00', // gold
  '#5856D6', // indigo
  '#FF3B30', // red
  '#30B0C7', // teal
  '#FF6482', // rose
  '#64D2FF', // sky
  '#BF5AF2', // violet
  '#32ADE6', // cyan-blue
  '#FF9F0A', // amber
  '#00C7BE', // mint
  '#AC8E68', // brown
  '#8E8E93', // gray
  '#FF375F', // strawberry
  '#0A84FF', // bright blue
  '#30D158', // lime green
  '#FFD60A', // yellow
  '#5E5CE6', // soft indigo
  '#FF6961', // coral
  '#40C8E0', // aqua
  '#DA8FFF', // lilac
  '#FF8A3D', // tangerine
  '#1B9E77', // forest
  '#D95F02', // burnt orange
  '#7570B3', // slate purple
  '#E7298A', // magenta
  '#66A61E', // olive
  '#E6AB02', // mustard
  '#A6761D', // oak
  '#1F78B4', // steel blue
  '#33A02C', // grass
  '#FB9A99', // salmon
  '#B2DF8A', // pale green
  '#A6CEE3', // pale blue
  '#FDBF6F', // sand
  '#CAB2D6', // lavender
  '#6A3D9A', // deep purple
  '#B15928', // rust
  '#FFFF99', // pale yellow (still readable with stroke)
  '#01665E', // deep teal
  '#D8B365', // khaki
  '#8C510A', // chocolate
  '#5AB4AC', // sea glass
  '#C51B7D', // fuchsia
  '#4D9221', // leaf
  '#2166AC', // royal
  '#B2182B', // crimson
] as const;

export const DAY_STORY_ROUTE_OPACITY = 0.5;

/** Stable color for visit N — same on every day, forever. */
export function dayStoryColorForVisit(visitNumber: number): string {
  const index =
    (((Math.max(1, Math.floor(visitNumber)) - 1) %
      DAY_STORY_VISIT_COLORS.length) +
      DAY_STORY_VISIT_COLORS.length) %
    DAY_STORY_VISIT_COLORS.length;
  return DAY_STORY_VISIT_COLORS[index]!;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '');
  if (raw.length !== 6) {
    return null;
  }
  const r = Number.parseInt(raw.slice(0, 2), 16);
  const g = Number.parseInt(raw.slice(2, 4), 16);
  const b = Number.parseInt(raw.slice(4, 6), 16);
  if ([r, g, b].some(n => Number.isNaN(n))) {
    return null;
  }
  return { r, g, b };
}

export function dayStoryRouteFill(
  hex: string,
  opacity: number = DAY_STORY_ROUTE_OPACITY,
): string {
  const rgb = hexToRgb(hex);
  if (rgb == null) {
    return `rgba(0, 122, 255, ${opacity})`;
  }
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
}

/**
 * Soft card fill: mix visit color into white (not a solid tint).
 * `amount` 0 = white, 1 = full visit color. Default ~14% wash.
 */
export function dayStoryCardFill(hex: string, amount = 0.14): string {
  const rgb = hexToRgb(hex);
  if (rgb == null) {
    return '#FFFFFF';
  }
  const t = Math.min(1, Math.max(0, amount));
  const mix = (channel: number) => Math.round(channel * t + 255 * (1 - t));
  return `rgb(${mix(rgb.r)}, ${mix(rgb.g)}, ${mix(rgb.b)})`;
}

export function dayStoryRouteBorder(
  opacity: number = DAY_STORY_ROUTE_OPACITY,
): string {
  return `rgba(255, 255, 255, ${opacity})`;
}
