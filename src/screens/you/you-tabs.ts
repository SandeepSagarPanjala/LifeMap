/**
 * You hub tab types + Insights back target — kept out of YouScreen /
 * InsightsScreen so those screens do not import each other.
 */

export type YouTabParamList = {
  Profile: undefined;
  Gallery: undefined;
  Insights: undefined;
  Friends: undefined;
  Achievements: undefined;
};

export type YouTabName = keyof YouTabParamList;

const YOU_TAB_NAMES = new Set<YouTabName>([
  'Profile',
  'Gallery',
  'Insights',
  'Friends',
  'Achievements',
]);

/** Survives You screen unmount so reopen restores the last tab. */
let lastYouTab: YouTabName = 'Profile';
/** Tab that was focused immediately before navigating to Insights. */
let youTabBeforeInsights: YouTabName = 'Profile';

export function readLastYouTab(): YouTabName {
  return YOU_TAB_NAMES.has(lastYouTab) ? lastYouTab : 'Profile';
}

export function rememberYouTab(next: YouTabName): void {
  if (next === 'Insights' && lastYouTab !== 'Insights') {
    youTabBeforeInsights = lastYouTab;
  }
  lastYouTab = next;
}

/** Call from Insights `tabPress` before the tab switch completes. */
export function rememberTabBeforeInsightsPress(): void {
  if (lastYouTab !== 'Insights') {
    youTabBeforeInsights = lastYouTab;
  }
}

/** Where Insights back should go (never Insights itself). */
export function getYouTabBeforeInsights(): YouTabName {
  if (
    youTabBeforeInsights !== 'Insights' &&
    YOU_TAB_NAMES.has(youTabBeforeInsights)
  ) {
    return youTabBeforeInsights;
  }
  return 'Profile';
}

export function isYouTabName(name: string): name is YouTabName {
  return YOU_TAB_NAMES.has(name as YouTabName);
}
