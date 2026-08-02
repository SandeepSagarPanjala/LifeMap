import { TZDate } from '@date-fns/tz';
import { addDays, startOfDay } from 'date-fns';
import { InteractionManager } from 'react-native';

import {
  createActivity,
  hardDeleteActivityWithMoments,
  listActivitiesByTemplateIdPrefix,
  setActivityCreatedAt,
  updateActivityReminder,
  type ActivityRow,
} from '@/db/repositories/activities';
import {
  insertActivityMomentsBulk,
  notifyMomentChangesForTimestamps,
} from '@/db/repositories/moments';
import {
  serializeActivityValuesJson,
  type ActivityFieldDefinition,
  type ActivityFieldValue,
} from '@/lib/activities/activity-definition';
import type { ActivityIntent } from '@/lib/activities/activity-intent';
import { toDateKey } from '@/lib/day-utils';
import {
  bootstrapGalleryDays,
  resetGalleryMomentsCache,
} from '@/lib/moments/gallery-moments-cache';
import type { ReminderRepeat } from '@/lib/notifications/types';
import { APP_TIMEZONE } from '@/lib/timezone';

export const DEV_DUMP_TEMPLATE_PREFIX = 'dev-dump:';

export type DumpActivitiesProgress =
  | { phase: 'clearing' }
  | { phase: 'activities'; done: number; total: number }
  | { phase: 'logs'; done: number; total: number }
  | { phase: 'finishing' };

export type DumpActivitiesResult = {
  activities: number;
  moments: number;
};

type DumpReminder = {
  repeat: ReminderRepeat;
  timeMinutes: number;
  weekday: number;
};

type DumpSpec = {
  slug: string;
  emoji: string;
  label: string;
  intent: ActivityIntent;
  field: ActivityFieldDefinition;
  reminder: DumpReminder | null;
  /** Return a value for this calendar day, or null to skip. */
  sample: (ctx: SampleCtx) => ActivityFieldValue | null;
};

type SampleCtx = {
  dateKey: string;
  dayIndex: number;
  totalDays: number;
  weekday: number; // 0=Sun … 6=Sat
  progress: number; // 0→1 over the window
  rand: () => number;
};

const VITAMIN_POOL = [
  'Vitamin D3',
  'Omega-3',
  'Magnesium',
  'B12',
  'Multivitamin',
  'Zinc',
  'Vitamin C',
] as const;

const JUNK_POOL = [
  'Chips',
  'Candy',
  'Cookies',
  'Ice cream',
  'Fries',
  'Donut',
  'Soda',
  'Pizza slice',
] as const;

const GROCERY_POOL = [
  'Milk',
  'Eggs',
  'Bread',
  'Chicken',
  'Rice',
  'Bananas',
  'Spinach',
  'Yogurt',
  'Coffee',
  'Oats',
  'Tomatoes',
  'Cheese',
] as const;

const GYM_OPTIONS = ['Back', 'Chest', 'Legs', 'Arms', 'Full body'] as const;
const SODA_OPTIONS = ['Cola', 'Lemon-lime', 'Orange', 'Ginger ale', 'Root beer'] as const;
const COMMUTE_OPTIONS = ['Drive', 'Transit', 'Walk', 'Bike', 'Rideshare'] as const;

function field(
  id: string,
  type: ActivityFieldDefinition['type'],
  label: string,
  options?: string[],
): ActivityFieldDefinition {
  return {
    id,
    type,
    label,
    required: true,
    ...(options ? { options } : {}),
  };
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function chance(rand: () => number, p: number): boolean {
  return rand() < p;
}

function pickOne<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)]!;
}

function pickSome(
  rand: () => number,
  pool: readonly string[],
  min: number,
  max: number,
): string[] {
  const count = min + Math.floor(rand() * (max - min + 1));
  const shuffled = [...pool].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function isWeekday(weekday: number): boolean {
  return weekday >= 1 && weekday <= 5;
}

function atLocalTime(
  dateKey: string,
  hour: number,
  minute: number,
  second = 0,
): Date {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new TZDate(y!, m! - 1, d!, hour, minute, second, 0, APP_TIMEZONE);
}

function yieldToUi(): Promise<void> {
  return new Promise(resolve => {
    InteractionManager.runAfterInteractions(() => {
      setTimeout(resolve, 0);
    });
  });
}

const DUMP_SPECS: DumpSpec[] = [
  // Money
  {
    slug: 'date-night-budget',
    emoji: '🕯️',
    label: 'Date Night Budget',
    intent: 'more',
    field: field('amount', 'money', 'Amount'),
    reminder: null,
    sample: ({ weekday, progress, rand }) => {
      // ~1–2×/month, slight upward spend for “do more”
      if (!chance(rand, 0.05)) {
        return null;
      }
      if (weekday === 1 || weekday === 2) {
        return null;
      }
      const base = lerp(55, 95, progress);
      return {
        type: 'money',
        amount: roundMoney(base + rand() * 55),
      };
    },
  },
  {
    slug: 'restaurant-food',
    emoji: '🍽️',
    label: 'Restaurant Food',
    intent: 'less',
    field: field('amount', 'money', 'Amount'),
    reminder: null,
    sample: ({ progress, rand }) => {
      // Year 2 less frequent
      const p = lerp(0.28, 0.12, progress);
      if (!chance(rand, p)) {
        return null;
      }
      return {
        type: 'money',
        amount: roundMoney(8 + rand() * 52),
      };
    },
  },
  {
    slug: 'gas',
    emoji: '⛽',
    label: 'Gas',
    intent: 'track',
    field: field('amount', 'money', 'Amount'),
    reminder: null,
    sample: ({ weekday, rand }) => {
      if (!isWeekday(weekday) && !chance(rand, 0.15)) {
        return null;
      }
      if (!chance(rand, 0.16)) {
        return null;
      }
      return {
        type: 'money',
        amount: roundMoney(25 + rand() * 45),
      };
    },
  },
  // Number
  {
    slug: 'water',
    emoji: '💧',
    label: 'Water',
    intent: 'more',
    field: field('glasses', 'number', 'Glasses'),
    reminder: { repeat: 'daily', timeMinutes: 9 * 60, weekday: 1 },
    sample: ({ progress, rand }) => {
      if (!chance(rand, 0.82)) {
        return null;
      }
      const base = lerp(3.5, 6.5, progress);
      return {
        type: 'number',
        value: Math.max(1, Math.round(base + rand() * 4)),
      };
    },
  },
  {
    slug: 'cigarettes',
    emoji: '🚬',
    label: 'Cigarettes',
    intent: 'less',
    field: field('count', 'number', 'Count'),
    reminder: null,
    sample: ({ progress, rand }) => {
      if (!chance(rand, lerp(0.85, 0.35, progress))) {
        return null;
      }
      const mean = lerp(10, 1.5, progress);
      return {
        type: 'number',
        value: Math.max(0, Math.round(mean + (rand() - 0.4) * 4)),
      };
    },
  },
  {
    slug: 'weight',
    emoji: '⚖️',
    label: 'Weight',
    intent: 'track',
    field: field('lbs', 'number', 'Weight (lb)'),
    reminder: null,
    sample: ({ weekday, progress, rand, dayIndex }) => {
      // ~weekly, prefer Sunday/Monday
      if (weekday !== 0 && weekday !== 1) {
        return null;
      }
      if (!chance(rand, 0.55)) {
        return null;
      }
      const drift = Math.sin(dayIndex / 40) * 2.5 + lerp(0, -3, progress);
      return {
        type: 'number',
        value: Math.round((172 + drift + (rand() - 0.5) * 1.2) * 10) / 10,
      };
    },
  },
  // List
  {
    slug: 'vitamins',
    emoji: '💊',
    label: 'Vitamins',
    intent: 'more',
    field: field('items', 'list', 'Vitamins'),
    reminder: { repeat: 'daily', timeMinutes: 8 * 60, weekday: 1 },
    sample: ({ rand }) => {
      if (!chance(rand, 0.88)) {
        return null;
      }
      return { type: 'list', items: pickSome(rand, VITAMIN_POOL, 1, 3) };
    },
  },
  {
    slug: 'junk-food-items',
    emoji: '🍟',
    label: 'Junk Food Items',
    intent: 'less',
    field: field('items', 'list', 'Items'),
    reminder: null,
    sample: ({ progress, rand }) => {
      if (!chance(rand, lerp(0.28, 0.12, progress))) {
        return null;
      }
      return { type: 'list', items: pickSome(rand, JUNK_POOL, 1, 3) };
    },
  },
  {
    slug: 'groceries',
    emoji: '🛒',
    label: 'Groceries',
    intent: 'track',
    field: field('items', 'list', 'Items'),
    reminder: null,
    sample: ({ weekday, rand }) => {
      if (weekday !== 0 && weekday !== 6 && !chance(rand, 0.08)) {
        return null;
      }
      if (!chance(rand, 0.55)) {
        return null;
      }
      return { type: 'list', items: pickSome(rand, GROCERY_POOL, 3, 7) };
    },
  },
  // Choice
  {
    slug: 'gym',
    emoji: '🏋️',
    label: 'Gym',
    intent: 'more',
    field: field('focus', 'choice', 'Focus', [...GYM_OPTIONS]),
    reminder: { repeat: 'weekdays', timeMinutes: 17 * 60 + 30, weekday: 1 },
    sample: ({ weekday, rand }) => {
      if (!isWeekday(weekday)) {
        return null;
      }
      if (!chance(rand, 0.78)) {
        return null;
      }
      // Legs bias
      if (chance(rand, 0.28)) {
        return { type: 'choice', value: 'Legs' };
      }
      return { type: 'choice', value: pickOne(rand, GYM_OPTIONS) };
    },
  },
  {
    slug: 'soda-flavor',
    emoji: '🥤',
    label: 'Soda Flavor',
    intent: 'less',
    field: field('flavor', 'choice', 'Flavor', [...SODA_OPTIONS]),
    reminder: null,
    sample: ({ progress, rand }) => {
      if (!chance(rand, lerp(0.32, 0.14, progress))) {
        return null;
      }
      if (chance(rand, 0.45)) {
        return { type: 'choice', value: 'Cola' };
      }
      return { type: 'choice', value: pickOne(rand, SODA_OPTIONS) };
    },
  },
  {
    slug: 'commute-mode',
    emoji: '🚌',
    label: 'Commute Mode',
    intent: 'track',
    field: field('mode', 'choice', 'Mode', [...COMMUTE_OPTIONS]),
    reminder: null,
    sample: ({ weekday, rand }) => {
      if (!isWeekday(weekday)) {
        return null;
      }
      if (!chance(rand, 0.9)) {
        return null;
      }
      if (chance(rand, 0.55)) {
        return { type: 'choice', value: 'Drive' };
      }
      return { type: 'choice', value: pickOne(rand, COMMUTE_OPTIONS) };
    },
  },
  // Duration
  {
    slug: 'meditation',
    emoji: '🧘',
    label: 'Meditation',
    intent: 'more',
    field: field('duration', 'duration', 'Duration'),
    reminder: { repeat: 'daily', timeMinutes: 7 * 60, weekday: 1 },
    sample: ({ progress, rand }) => {
      if (!chance(rand, 0.72)) {
        return null;
      }
      const minutes = lerp(8, 18, progress) + rand() * 8;
      return {
        type: 'duration',
        seconds: Math.round(minutes * 60),
      };
    },
  },
  {
    slug: 'screen-time-social',
    emoji: '📱',
    label: 'Screen Time (social)',
    intent: 'less',
    field: field('duration', 'duration', 'Duration'),
    reminder: null,
    sample: ({ progress, rand }) => {
      if (!chance(rand, 0.9)) {
        return null;
      }
      const minutes = lerp(95, 45, progress) + rand() * 35;
      return {
        type: 'duration',
        seconds: Math.round(Math.max(15, minutes) * 60),
      };
    },
  },
  {
    slug: 'shower',
    emoji: '🚿',
    label: 'Shower',
    intent: 'track',
    field: field('duration', 'duration', 'Duration'),
    reminder: null,
    sample: ({ rand }) => {
      if (!chance(rand, 0.92)) {
        return null;
      }
      const minutes = 5 + rand() * 15;
      return {
        type: 'duration',
        seconds: Math.round(minutes * 60),
      };
    },
  },
  // Toggle
  {
    slug: 'medication',
    emoji: '💉',
    label: 'Medication',
    intent: 'more',
    field: field('taken', 'toggle', 'Taken'),
    reminder: { repeat: 'daily', timeMinutes: 8 * 60 + 15, weekday: 1 },
    sample: ({ rand }) => {
      if (!chance(rand, 0.95)) {
        return null;
      }
      return { type: 'toggle', value: chance(rand, 0.85) };
    },
  },
  {
    slug: 'skipped-workout',
    emoji: '😴',
    label: 'Skipped Workout',
    intent: 'less',
    field: field('skipped', 'toggle', 'Skipped'),
    reminder: null,
    sample: ({ weekday, rand }) => {
      if (!isWeekday(weekday)) {
        return null;
      }
      if (!chance(rand, 0.18)) {
        return null;
      }
      return { type: 'toggle', value: true };
    },
  },
  {
    slug: 'worked-from-home',
    emoji: '🏠',
    label: 'Worked From Home',
    intent: 'track',
    field: field('wfh', 'toggle', 'Worked from home'),
    reminder: null,
    sample: ({ weekday, rand }) => {
      if (!isWeekday(weekday)) {
        return null;
      }
      if (!chance(rand, 0.92)) {
        return null;
      }
      return { type: 'toggle', value: chance(rand, 0.4) };
    },
  },
];

function buildDayKeys(now = new Date()): string[] {
  const end = startOfDay(new TZDate(now, APP_TIMEZONE));
  // 730 calendar days inclusive of today (~2 years).
  const first = addDays(end, -729);
  const keys: string[] = [];
  for (let d = first; d.getTime() <= end.getTime(); d = addDays(d, 1)) {
    keys.push(toDateKey(d));
  }
  return keys;
}

function hourForSlug(slug: string, rand: () => number): { h: number; m: number } {
  const base =
    {
      water: 10,
      vitamins: 8,
      gym: 18,
      meditation: 7,
      medication: 8,
      shower: 7,
      'screen-time-social': 21,
      'commute-mode': 8,
      gas: 17,
      groceries: 11,
      'date-night-budget': 19,
      'restaurant-food': 12,
      cigarettes: 14,
      weight: 7,
      'junk-food-items': 15,
      'soda-flavor': 14,
      'skipped-workout': 17,
      'worked-from-home': 9,
    }[slug] ?? 12;
  return {
    h: base,
    m: Math.floor(rand() * 50),
  };
}

export async function dumpActivitiesSeed(
  onProgress?: (progress: DumpActivitiesProgress) => void,
): Promise<DumpActivitiesResult> {
  onProgress?.({ phase: 'clearing' });
  const existing = await listActivitiesByTemplateIdPrefix(
    DEV_DUMP_TEMPLATE_PREFIX,
  );
  for (const row of existing) {
    await hardDeleteActivityWithMoments(row.id);
  }
  await yieldToUi();

  const dayKeys = buildDayKeys();
  const totalDays = dayKeys.length;
  const createdAt = atLocalTime(dayKeys[0]!, 8, 0);

  const created: ActivityRow[] = [];
  const totalSpecs = DUMP_SPECS.length;
  for (let i = 0; i < totalSpecs; i++) {
    const spec = DUMP_SPECS[i]!;
    const row = await createActivity({
      emoji: spec.emoji,
      label: spec.label,
      fields: [spec.field],
      source: 'catalog',
      templateId: `${DEV_DUMP_TEMPLATE_PREFIX}${spec.slug}`,
      intent: spec.intent,
    });
    await setActivityCreatedAt(row.id, createdAt);
    if (spec.reminder) {
      await updateActivityReminder(row.id, {
        reminderEnabled: true,
        reminderRepeat: spec.reminder.repeat,
        reminderTimeMinutes: spec.reminder.timeMinutes,
        reminderWeekday: spec.reminder.weekday,
        reminderDayOfMonth: 1,
        reminderAnchorAt: null,
        reminderSound: 'ding',
      });
    }
    created.push(row);
    onProgress?.({ phase: 'activities', done: i + 1, total: totalSpecs });
    if (i % 3 === 2) {
      await yieldToUi();
    }
  }

  type BulkRow = {
    timestamp: Date;
    activityId: number;
    activityEmoji: string;
    activityLabel: string;
    activityValuesJson: string | null;
  };

  const allRows: BulkRow[] = [];
  for (let si = 0; si < DUMP_SPECS.length; si++) {
    const spec = DUMP_SPECS[si]!;
    const activity = created[si]!;
    const rand = mulberry32(hashSlug(spec.slug) ^ 0xa5f1c3);
    for (let di = 0; di < dayKeys.length; di++) {
      const dateKey = dayKeys[di]!;
      const [y, m, d] = dateKey.split('-').map(Number);
      const weekday = new TZDate(y!, m! - 1, d!, APP_TIMEZONE).getDay();
      const value = spec.sample({
        dateKey,
        dayIndex: di,
        totalDays,
        weekday,
        progress: totalDays <= 1 ? 1 : di / (totalDays - 1),
        rand,
      });
      if (value == null) {
        continue;
      }
      const { h, m: minute } = hourForSlug(spec.slug, rand);
      const timestamp = atLocalTime(
        dateKey,
        h,
        minute,
        Math.floor(rand() * 50),
      );
      allRows.push({
        timestamp,
        activityId: activity.id,
        activityEmoji: activity.emoji,
        activityLabel: activity.label,
        activityValuesJson: serializeActivityValuesJson({
          [spec.field.id]: value,
        }),
      });
    }
  }

  // Chronological insert is nicer for debugging; not required.
  allRows.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

  const totalLogs = allRows.length;
  let inserted = 0;
  const chunkSize = 400;
  for (let offset = 0; offset < allRows.length; offset += chunkSize) {
    const chunk = allRows.slice(offset, offset + chunkSize);
    await insertActivityMomentsBulk(chunk, chunk.length);
    inserted += chunk.length;
    onProgress?.({ phase: 'logs', done: inserted, total: totalLogs });
    await yieldToUi();
  }

  onProgress?.({ phase: 'finishing' });
  resetGalleryMomentsCache();
  await bootstrapGalleryDays();
  // Single notify so open gallery screens republish from the fresh cache.
  notifyMomentChangesForTimestamps([new Date()]);

  return { activities: created.length, moments: inserted };
}
