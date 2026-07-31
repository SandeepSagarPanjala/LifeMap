import {
  DEFAULT_ACTIVITY_INTENT,
  isActivityIntent,
  parseActivityIntent,
} from '@/lib/activities/activity-intent';

describe('activity intent', () => {
  it('defaults to just track', () => {
    expect(DEFAULT_ACTIVITY_INTENT).toBe('track');
  });

  it('accepts known intents', () => {
    expect(isActivityIntent('track')).toBe(true);
    expect(isActivityIntent('more')).toBe(true);
    expect(isActivityIntent('less')).toBe(true);
    expect(isActivityIntent('good')).toBe(false);
  });

  it('parses unknown or missing values as track', () => {
    expect(parseActivityIntent(undefined)).toBe('track');
    expect(parseActivityIntent(null)).toBe('track');
    expect(parseActivityIntent('positive')).toBe('track');
    expect(parseActivityIntent('more')).toBe('more');
    expect(parseActivityIntent('less')).toBe('less');
  });
});
