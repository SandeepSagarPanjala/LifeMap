import L from 'leaflet';

import {
  normalizeMotionActivity,
  type MotionActivityType,
} from '@lifemap/segmentation';

export type ActivityMarkerState = {
  activityType: string | null | undefined;
  selected?: boolean;
  stopMember?: boolean;
  dimmed?: boolean;
  stopStart?: boolean;
  stopEnd?: boolean;
  motionDeparture?: boolean;
};

const ICON_CACHE = new Map<string, L.DivIcon>();

const ACTIVITY_META: Record<
  MotionActivityType | 'missing',
  { label: string; bg: string; svg: string }
> = {
  in_vehicle: {
    label: 'car',
    bg: '#007aff',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M5 11 6.5 6.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1.1a2.5 2.5 0 0 1-4.8 0H9.9a2.5 2.5 0 0 1-4.8 0H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm2.1 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm9.8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM7.2 11h9.6l-1.1-3.3a.5.5 0 0 0-.5-.4H8.8a.5.5 0 0 0-.5.4Z"/></svg>`,
  },
  on_bicycle: {
    label: 'bike',
    bg: '#5856d6',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M5.5 17.5a3 3 0 1 1 0-6 3 3 0 0 1 0 6Zm13 0a3 3 0 1 1 0-6 3 3 0 0 1 0 6ZM5.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm13 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm-8.2-5.2 1.4 2.7h3.1l1.3-2.2h1.7l-1.9 3.2 2.1 3.1h-1.8l-1.5-2.3H11l-1.2 2.3H8.1l2.2-4.1-1.5-2.7Z"/></svg>`,
  },
  on_foot: {
    label: 'foot',
    bg: '#34c759',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M8.2 4.8c1.1 0 2 .9 2 2.1 0 1.7-1.6 2.8-2.8 3.8-.4.3-.7.6-.9 1H8c.8 0 1.4.3 1.8.8l2.4 3.1c.4.5.4 1.2 0 1.7l-.7.8c-.4.4-1 .4-1.4 0l-2-2.1c-.4-.4-1-.4-1.4 0L5.2 16c-.5.5-1.3.4-1.7-.2l-.5-.8c-.3-.6 0-1.3.6-1.6 1.1-.6 2.1-1.4 2.9-2.5.7-1 1.2-1.7 1.2-2.2 0-.4-.3-.7-.7-.7s-.8.4-1.3 1.1c-.3.5-1 .6-1.4.2-.5-.4-.5-1.1 0-1.5.9-.9 2-1.9 3-1.9Zm7.6.2c1.3 0 2.4 1.1 2.4 2.5 0 2.1-1.9 3.4-3.4 4.6-.5.4-.9.8-1.2 1.3h1.8c.9 0 1.6.4 2.1 1l2.2 2.7c.4.5.4 1.2-.1 1.6l-.7.7c-.4.4-1.1.3-1.5-.1l-1.7-1.8c-.4-.4-1-.4-1.4 0l-1.4 1.4c-.5.5-1.3.4-1.7-.2l-.4-.7c-.3-.6 0-1.3.6-1.6 1.2-.6 2.3-1.5 3.2-2.8.8-1.2 1.4-2 1.4-2.6 0-.5-.4-.9-.9-.9s-1 .5-1.6 1.3c-.4.5-1.1.6-1.5.2-.5-.4-.5-1.2.1-1.6 1.1-1 2.4-2.1 3.6-2.1Z"/></svg>`,
  },
  walking: {
    label: 'walk',
    bg: '#30d158',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M13.5 5.2a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0ZM10.2 8.4h2.5l1.2 3.3 2.4 1.3-.8 1.5-2.6-1.4-1.1 3.2 2.7 2.7-1.2 1.2-2.8-2.8-1.4 3.9-1.6-.6 1.8-5.1-.9-2.5-2.1 1.5-.8-1.5 2.7-1.9Z"/></svg>`,
  },
  running: {
    label: 'run',
    bg: '#ff9f0a',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M14.8 4.8a1.8 1.8 0 1 1-3.6 0 1.8 1.8 0 0 1 3.6 0Zm-5.3 3.4 2.8.4 1.1 2.4 3.1-.2.2 1.6-3.7.3-1.3 2.8 2.6 1.9-.9 1.4-3.4-2.4-1.8 3.8-1.5-.7 2-4.3-1.4-3.1-2.4 1.3-.7-1.5 3.2-1.7Z"/></svg>`,
  },
  still: {
    label: 'still',
    bg: '#8e8e93',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M8 6.5h2.8v11H8zm5.2 0H16v11h-2.8z"/></svg>`,
  },
  unknown: {
    label: 'unknown',
    bg: '#636366',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M12 3.8A5.2 5.2 0 0 1 17.2 9c0 2.3-1.3 3.5-2.6 4.5-.8.6-1.4 1.1-1.4 2v.7h-2.1V15.5c0-1.6.9-2.4 1.9-3.2 1.1-.9 1.9-1.6 1.9-3.3a3.1 3.1 0 0 0-6.2 0H6.6A5.2 5.2 0 0 1 12 3.8ZM12 17.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z"/></svg>`,
  },
  missing: {
    label: 'unknown',
    bg: '#636366',
    svg: `<svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path fill="#fff" d="M12 3.8A5.2 5.2 0 0 1 17.2 9c0 2.3-1.3 3.5-2.6 4.5-.8.6-1.4 1.1-1.4 2v.7h-2.1V15.5c0-1.6.9-2.4 1.9-3.2 1.1-.9 1.9-1.6 1.9-3.3a3.1 3.1 0 0 0-6.2 0H6.6A5.2 5.2 0 0 1 12 3.8ZM12 17.8a1.4 1.4 0 1 1 0 2.8 1.4 1.4 0 0 1 0-2.8Z"/></svg>`,
  },
};

function resolveActivityKey(
  activityType: string | null | undefined,
): MotionActivityType | 'missing' {
  return normalizeMotionActivity(activityType) ?? 'missing';
}

/** Canvas-friendly fill color for activity (used when icons are too heavy). */
export function activityFillColor(
  activityType: string | null | undefined,
): string {
  return ACTIVITY_META[resolveActivityKey(activityType)].bg;
}

function ringColor(state: ActivityMarkerState): string | null {
  if (state.stopStart) {
    return '#af52de';
  }
  if (state.stopEnd) {
    return '#000000';
  }
  if (state.selected) {
    return '#ff9500';
  }
  if (state.motionDeparture) {
    return '#ff9500';
  }
  if (state.stopMember) {
    return '#ff3b30';
  }
  return null;
}

export function activityPointIcon(state: ActivityMarkerState): L.DivIcon {
  const activityKey = resolveActivityKey(state.activityType);
  const meta = ACTIVITY_META[activityKey];
  const ring = ringColor(state);
  const size = state.stopStart || state.stopEnd || state.selected ? 22 : 18;
  const cacheKey = [
    activityKey,
    ring ?? 'none',
    size,
    state.dimmed ? 'dim' : 'full',
  ].join('|');

  const cached = ICON_CACHE.get(cacheKey);
  if (cached != null) {
    return cached;
  }

  const opacity = state.dimmed ? '0.35' : '1';
  const border = ring != null ? `2px solid ${ring}` : '1.5px solid #ffffff';
  const boxShadow =
    ring != null
      ? `0 0 0 2px ${ring}55, 0 1px 2px rgba(0,0,0,0.35)`
      : '0 1px 2px rgba(0,0,0,0.35)';

  const icon = L.divIcon({
    className: 'activity-point-marker',
    html: `<div class="activity-point-badge" style="width:${size}px;height:${size}px;background:${meta.bg};border:${border};box-shadow:${boxShadow};opacity:${opacity}" title="${meta.label}">${meta.svg}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
  ICON_CACHE.set(cacheKey, icon);
  return icon;
}
