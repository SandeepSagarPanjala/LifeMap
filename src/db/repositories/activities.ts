import { asc, count, eq, isNull, sql } from 'drizzle-orm';

import {
  ACTIVITY_SCHEMA_VERSION,
  serializeActivityFieldsJson,
  type ActivityDefinition,
  type ActivityDefinitionSource,
  type ActivityFieldDefinition,
  definitionFromActivityRow,
  parseActivityFieldsJson,
} from '@/lib/activities/activity-definition';
import {
  cancelActivityReminder,
} from '@/lib/notifications/service';
import {
  isReminderRepeat,
  isReminderSound,
  type ReminderRepeat,
  type ReminderSound,
} from '@/lib/notifications/types';

import { getDatabase } from '../client';
import { activities, moments } from '../schema';

export type ActivityRow = {
  id: number;
  emoji: string;
  label: string;
  sortOrder: number;
  createdAt: Date;
  archivedAt: Date | null;
  schemaVersion: number;
  source: ActivityDefinitionSource;
  templateId: string | null;
  definitionJson: string;
  fields: ActivityFieldDefinition[];
  reminderEnabled: boolean;
  reminderRepeat: ReminderRepeat;
  reminderTimeMinutes: number | null;
  reminderWeekday: number | null;
  reminderDayOfMonth: number | null;
  reminderAnchorAt: Date | null;
  reminderSound: ReminderSound;
};

export type NewActivity = {
  emoji: string;
  label: string;
  fields?: ActivityFieldDefinition[];
  source?: ActivityDefinitionSource;
  templateId?: string | null;
  schemaVersion?: number;
};

export type ActivityReminderPatch = {
  reminderEnabled: boolean;
  reminderRepeat: ReminderRepeat;
  reminderTimeMinutes: number;
  reminderWeekday: number;
  reminderDayOfMonth: number;
  reminderAnchorAt: Date | null;
  reminderSound: ReminderSound;
};

function mapSource(value: string | null | undefined): ActivityDefinitionSource {
  if (value === 'yaml' || value === 'catalog' || value === 'blank') {
    return value;
  }
  return 'blank';
}

function mapRow(row: typeof activities.$inferSelect): ActivityRow {
  const definitionJson = row.definitionJson ?? '[]';
  const repeatRaw = row.reminderRepeat ?? 'never';
  const soundRaw = row.reminderSound ?? 'ding';
  return {
    id: row.id,
    emoji: row.emoji,
    label: row.label,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt ?? null,
    schemaVersion: row.schemaVersion ?? ACTIVITY_SCHEMA_VERSION,
    source: mapSource(row.source),
    templateId: row.templateId ?? null,
    definitionJson,
    fields: parseActivityFieldsJson(definitionJson),
    reminderEnabled: Boolean(row.reminderEnabled),
    reminderRepeat: isReminderRepeat(repeatRaw) ? repeatRaw : 'never',
    reminderTimeMinutes: row.reminderTimeMinutes ?? null,
    reminderWeekday: row.reminderWeekday ?? null,
    reminderDayOfMonth: row.reminderDayOfMonth ?? null,
    reminderAnchorAt: row.reminderAnchorAt ?? null,
    reminderSound: isReminderSound(soundRaw) ? soundRaw : 'ding',
  };
}

export function activityRowToDefinition(row: ActivityRow): ActivityDefinition {
  return definitionFromActivityRow(row);
}

export async function listActiveActivities(): Promise<ActivityRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(activities)
    .where(isNull(activities.archivedAt))
    .orderBy(asc(activities.sortOrder), asc(activities.id));
  return rows.map(mapRow);
}

export async function createActivity(input: NewActivity): Promise<ActivityRow> {
  const db = await getDatabase();
  const [maxRow] = await db
    .select({
      maxOrder: sql<number>`coalesce(max(${activities.sortOrder}), -1)`,
    })
    .from(activities);
  const sortOrder = Number(maxRow?.maxOrder ?? -1) + 1;
  const fields = input.fields ?? [];
  const rows = await db
    .insert(activities)
    .values({
      emoji: input.emoji.trim(),
      label: input.label.trim(),
      sortOrder,
      createdAt: new Date(),
      schemaVersion: input.schemaVersion ?? ACTIVITY_SCHEMA_VERSION,
      source: input.source ?? 'blank',
      templateId: input.templateId ?? null,
      definitionJson: serializeActivityFieldsJson(fields),
    })
    .returning();
  return mapRow(rows[0]!);
}

export async function createActivityFromDefinition(
  definition: ActivityDefinition,
  source: ActivityDefinitionSource = 'yaml',
): Promise<ActivityRow> {
  return createActivity({
    emoji: definition.emoji,
    label: definition.name,
    fields: definition.fields,
    source,
    templateId: definition.templateId ?? null,
    schemaVersion: definition.schemaVersion,
  });
}

export async function updateActivity(
  id: number,
  input: NewActivity,
): Promise<ActivityRow | null> {
  const existing = await getActivityById(id);
  if (existing == null) {
    return null;
  }
  const db = await getDatabase();
  const fields = input.fields ?? existing.fields;
  const rows = await db
    .update(activities)
    .set({
      emoji: input.emoji.trim(),
      label: input.label.trim(),
      schemaVersion: input.schemaVersion ?? existing.schemaVersion,
      source: input.source ?? existing.source,
      templateId:
        input.templateId !== undefined ? input.templateId : existing.templateId,
      definitionJson: serializeActivityFieldsJson(fields),
    })
    .where(eq(activities.id, id))
    .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function updateActivityReminder(
  id: number,
  patch: ActivityReminderPatch,
): Promise<ActivityRow | null> {
  const db = await getDatabase();
  const rows = await db
    .update(activities)
    .set({
      reminderEnabled: patch.reminderEnabled,
      reminderRepeat: patch.reminderRepeat,
      reminderTimeMinutes: patch.reminderTimeMinutes,
      reminderWeekday: patch.reminderWeekday,
      reminderDayOfMonth: patch.reminderDayOfMonth,
      reminderAnchorAt: patch.reminderAnchorAt,
      reminderSound: patch.reminderSound,
    })
    .where(eq(activities.id, id))
    .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function clearActivityReminder(id: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(activities)
    .set({
      reminderEnabled: false,
    })
    .where(eq(activities.id, id));
  await cancelActivityReminder(id);
}

export async function countMomentsForActivity(
  activityId: number,
): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .select({ value: count() })
    .from(moments)
    .where(eq(moments.activityId, activityId));
  return Number(rows[0]?.value ?? 0);
}

export async function archiveActivity(id: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(activities)
    .set({ archivedAt: new Date(), reminderEnabled: false })
    .where(eq(activities.id, id));
  await cancelActivityReminder(id);
}

/** Hard-delete when never logged; otherwise archive (soft-delete). */
export async function deleteOrArchiveActivity(id: number): Promise<'deleted' | 'archived'> {
  const logged = await countMomentsForActivity(id);
  if (logged > 0) {
    await archiveActivity(id);
    return 'archived';
  }
  await cancelActivityReminder(id);
  const db = await getDatabase();
  await db.delete(activities).where(eq(activities.id, id));
  return 'deleted';
}

export async function reorderActivities(orderedIds: number[]): Promise<void> {
  if (orderedIds.length === 0) {
    return;
  }
  const db = await getDatabase();
  await db.transaction(async tx => {
    for (let index = 0; index < orderedIds.length; index++) {
      await tx
        .update(activities)
        .set({ sortOrder: index })
        .where(eq(activities.id, orderedIds[index]!));
    }
  });
}

export async function getActivityById(id: number): Promise<ActivityRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(activities)
    .where(eq(activities.id, id))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}
