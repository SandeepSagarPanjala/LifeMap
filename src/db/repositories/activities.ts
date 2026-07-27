import { asc, eq, isNull, sql } from 'drizzle-orm';

import {
  ACTIVITY_SCHEMA_VERSION,
  serializeActivityFieldsJson,
  type ActivityDefinition,
  type ActivityDefinitionSource,
  type ActivityFieldDefinition,
  definitionFromActivityRow,
  parseActivityFieldsJson,
} from '@/lib/activities/activity-definition';

import { getDatabase } from '../client';
import { activities } from '../schema';

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
};

export type NewActivity = {
  emoji: string;
  label: string;
  fields?: ActivityFieldDefinition[];
  source?: ActivityDefinitionSource;
  templateId?: string | null;
  schemaVersion?: number;
};

function mapSource(value: string | null | undefined): ActivityDefinitionSource {
  if (value === 'yaml' || value === 'catalog' || value === 'blank') {
    return value;
  }
  return 'blank';
}

function mapRow(row: typeof activities.$inferSelect): ActivityRow {
  const definitionJson = row.definitionJson ?? '[]';
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
  const db = await getDatabase();
  const fields = input.fields ?? [];
  const rows = await db
    .update(activities)
    .set({
      emoji: input.emoji.trim(),
      label: input.label.trim(),
      schemaVersion: input.schemaVersion ?? ACTIVITY_SCHEMA_VERSION,
      source: input.source ?? 'blank',
      templateId: input.templateId ?? null,
      definitionJson: serializeActivityFieldsJson(fields),
    })
    .where(eq(activities.id, id))
    .returning();
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function archiveActivity(id: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(activities)
    .set({ archivedAt: new Date() })
    .where(eq(activities.id, id));
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
