type SavedPlaceKind = 'home' | 'work' | 'favorite';

const ICON_PATHS: Record<SavedPlaceKind, string> = {
  home: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z',
  work: 'M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-2 .89-2 2v11c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z',
  favorite:
    'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
};

export const SAVED_PLACE_ICON_COLOR: Record<SavedPlaceKind, string> = {
  home: '#FF9500',
  work: '#007AFF',
  favorite: '#FF375F',
};

/** History visit card + map callout — mobile uses stay orange for all saved place icons. */
export const SAVED_PLACE_VISIT_COLOR = '#FF9500';

type SavedPlaceIconProps = {
  kind: SavedPlaceKind;
  size?: number;
  color?: string;
};

export function savedPlaceIconHtml(
  kind: SavedPlaceKind,
  size: number,
  color: string = SAVED_PLACE_VISIT_COLOR,
): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICON_PATHS[kind]}" fill="${color}"/></svg>`;
}

export function SavedPlaceIcon({
  kind,
  size = 16,
  color = SAVED_PLACE_ICON_COLOR[kind],
}: SavedPlaceIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className="mobile-saved-place-icon">
      <path d={ICON_PATHS[kind]} fill={color} />
    </svg>
  );
}
