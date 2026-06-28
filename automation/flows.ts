export type AutomationFlowPriority = 'p0' | 'p1' | 'p2';

export type AutomationConcept =
  | 'Smoke'
  | 'Saved places'
  | 'History'
  | 'Moments'
  | 'Settings';

export type AutomationFlow = {
  /** Stable id — matches `__UI__/<concept>/<id>.yaml`. */
  id: string;
  concept: AutomationConcept;
  priority: AutomationFlowPriority;
  /** Short user-journey label for reports and CI. */
  journey: string;
  description: string;
};

/** Registry of device UI flows. Keep in sync with `__UI__/`. */
export const AUTOMATION_FLOWS: AutomationFlow[] = [
  {
    id: 'smoke',
    concept: 'Smoke',
    priority: 'p0',
    journey: 'Cold start → map',
    description: 'App launches past splash/onboarding and shows map controls.',
  },
  {
    id: 'map-open-settings',
    concept: 'Settings',
    priority: 'p0',
    journey: 'Map → Settings → Map',
    description: 'Settings opens from the gear button and back returns to map.',
  },
  {
    id: 'map-open-camera',
    concept: 'Moments',
    priority: 'p0',
    journey: 'Map → Camera → Map',
    description: 'Camera opens from the shutter button and closes without saving.',
  },
  {
    id: 'map-camera-flip',
    concept: 'Moments',
    priority: 'p0',
    journey: 'Map → Camera flip',
    description: 'Front/back camera toggle keeps the shutter usable.',
  },
  {
    id: 'map-open-history',
    concept: 'History',
    priority: 'p0',
    journey: 'Map → History panel',
    description: 'History panel opens and closes for today.',
  },
  {
    id: 'map-open-saved-places',
    concept: 'Saved places',
    priority: 'p0',
    journey: 'Map → Saved places',
    description: 'Saved places sheet opens and dismisses.',
  },
  {
    id: '2nd-level-sheet-dismiss',
    concept: 'Saved places',
    priority: 'p0',
    journey: 'Saved places stacked sheet dismiss',
    description:
      'After add-by-address closes, one backdrop tap dismisses saved places (regression guard).',
  },
  {
    id: 'saved-places-crud',
    concept: 'Saved places',
    priority: 'p1',
    journey: 'Saved places CRUD',
    description:
      'Add Home, Work, and Favorite by address; rename favorite; delete all.',
  },
];

export const AUTOMATION_FLOW_IDS = AUTOMATION_FLOWS.map(flow => flow.id);

export function automationFlowRelativePath(flow: AutomationFlow): string {
  return `__UI__/${flow.concept}/${flow.id}.yaml`;
}
