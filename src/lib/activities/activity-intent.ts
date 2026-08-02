/** User direction for logging an activity — used later for insights. */
export type ActivityIntent = 'track' | 'more' | 'less';

export const ACTIVITY_INTENTS: readonly ActivityIntent[] = [
  'track',
  'more',
  'less',
] as const;

export const DEFAULT_ACTIVITY_INTENT: ActivityIntent = 'track';

export const ACTIVITY_INTENT_OPTIONS: Array<{
  value: ActivityIntent;
  label: string;
  hint: string;
}> = [
  {
    value: 'track',
    label: 'Just tracking',
    hint: 'No preference either way',
  },
  {
    value: 'more',
    label: 'Good habit',
    hint: 'Want to do this regularly',
  },
  {
    value: 'less',
    label: 'Bad habit',
    hint: 'Want to cut back',
  },
];

export function isActivityIntent(value: unknown): value is ActivityIntent {
  return value === 'track' || value === 'more' || value === 'less';
}

/** Coerce unknown / legacy backup values to a valid intent. */
export function parseActivityIntent(value: unknown): ActivityIntent {
  return isActivityIntent(value) ? value : DEFAULT_ACTIVITY_INTENT;
}

export function activityIntentLabel(intent: ActivityIntent): string {
  return (
    ACTIVITY_INTENT_OPTIONS.find(option => option.value === intent)?.label ??
    ACTIVITY_INTENT_OPTIONS[0]!.label
  );
}

/** Hero copy for activity insights (Do more / Do less / Tracking). */
export function activityExperienceIntentLabel(intent: ActivityIntent): string {
  switch (intent) {
    case 'more':
      return 'Do more';
    case 'less':
      return 'Do less';
    case 'track':
      return 'Tracking';
  }
}
