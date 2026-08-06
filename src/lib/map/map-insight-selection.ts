import { getSetting, setSetting } from '@/db/repositories/settings';
import type {
  MapInsightFilterOption,
  MapInsightTab,
} from '@/lib/map/map-insight-period-options';
import {
  defaultMapInsightFilterOption,
} from '@/lib/map/map-insight-period-options';

export const SETTINGS_KEY_MAP_INSIGHT_TAB = 'map_insight_tab';
export const SETTINGS_KEY_MAP_INSIGHT_FILTER_JSON = 'map_insight_filter_json';
export const SETTINGS_KEY_MAP_INSIGHT_WEEK_FOCUS_JSON =
  'map_insight_week_focus_json';

export function isMapInsightTab(value: string | null | undefined): value is MapInsightTab {
  return (
    value === 'overview' ||
    value === 'today' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year'
  );
}

function parseFilterOption(
  raw: string | null | undefined,
): MapInsightFilterOption | null {
  if (raw == null || !raw.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<MapInsightFilterOption>;
    if (
      typeof parsed.id !== 'string' ||
      typeof parsed.label !== 'string' ||
      typeof parsed.startDateKey !== 'string' ||
      typeof parsed.endDateKey !== 'string' ||
      typeof parsed.isCurrent !== 'boolean'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      label: parsed.label,
      startDateKey: parsed.startDateKey,
      endDateKey: parsed.endDateKey,
      isCurrent: parsed.isCurrent,
      weekIndex:
        typeof parsed.weekIndex === 'number' ? parsed.weekIndex : undefined,
    };
  } catch {
    return null;
  }
}

export type PersistedMapInsightSelection = {
  tab: MapInsightTab;
  filter: MapInsightFilterOption | null;
  weekFocus: MapInsightFilterOption;
};

/** Default when nothing is stored yet — Overview. */
export function defaultPersistedMapInsightSelection(): PersistedMapInsightSelection {
  return {
    tab: 'overview',
    filter: null,
    weekFocus: defaultMapInsightFilterOption('week'),
  };
}

export async function loadPersistedMapInsightSelection(): Promise<PersistedMapInsightSelection> {
  const defaults = defaultPersistedMapInsightSelection();
  const [tabRaw, filterRaw, weekRaw] = await Promise.all([
    getSetting(SETTINGS_KEY_MAP_INSIGHT_TAB),
    getSetting(SETTINGS_KEY_MAP_INSIGHT_FILTER_JSON),
    getSetting(SETTINGS_KEY_MAP_INSIGHT_WEEK_FOCUS_JSON),
  ]);

  const tab = isMapInsightTab(tabRaw) ? tabRaw : defaults.tab;
  const weekFocus =
    parseFilterOption(weekRaw) ?? defaults.weekFocus;
  let filter = parseFilterOption(filterRaw);

  if (tab === 'overview') {
    filter = null;
  } else if (filter == null) {
    filter = defaultMapInsightFilterOption(tab);
  } else if (tab === 'today') {
    // Always use the current calendar day when restoring Today.
    filter = defaultMapInsightFilterOption('today');
  }

  return { tab, filter, weekFocus };
}

export async function persistMapInsightSelection(input: {
  tab: MapInsightTab;
  filter: MapInsightFilterOption | null;
  weekFocus: MapInsightFilterOption;
}): Promise<void> {
  await Promise.all([
    setSetting(SETTINGS_KEY_MAP_INSIGHT_TAB, input.tab),
    setSetting(
      SETTINGS_KEY_MAP_INSIGHT_FILTER_JSON,
      input.filter != null ? JSON.stringify(input.filter) : '',
    ),
    setSetting(
      SETTINGS_KEY_MAP_INSIGHT_WEEK_FOCUS_JSON,
      JSON.stringify(input.weekFocus),
    ),
  ]);
}
