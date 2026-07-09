import { desc, gte, sql } from 'drizzle-orm';

import { getDatabase } from '../client';
import { trackingEvents } from '../schema';

export type TrackingEventInput = {
  timestamp?: Date;
  event: string;
  details?: Record<string, unknown> | null;
};

export type TrackingEventRow = {
  id: number;
  timestamp: Date;
  event: string;
  details: Record<string, unknown> | null;
};

function parseDetails(raw: string | null): Record<string, unknown> | null {
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function insertTrackingEvent(
  input: TrackingEventInput,
): Promise<void> {
  const db = await getDatabase();
  await db.insert(trackingEvents).values({
    timestamp: input.timestamp ?? new Date(),
    event: input.event,
    details: input.details == null ? null : JSON.stringify(input.details),
  });
}

export async function countTrackingEvents(): Promise<number> {
  const db = await getDatabase();
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(trackingEvents);
  return Number(result[0]?.count ?? 0);
}

export async function deleteAllTrackingEvents(): Promise<number> {
  const deleted = await countTrackingEvents();
  if (deleted === 0) {
    return 0;
  }
  const db = await getDatabase();
  await db.delete(trackingEvents);
  return deleted;
}

export async function getAllTrackingEvents(): Promise<TrackingEventRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(trackingEvents)
    .orderBy(desc(trackingEvents.timestamp), desc(trackingEvents.id));
  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    event: row.event,
    details: parseDetails(row.details),
  }));
}

export async function getTrackingEventsSince(
  since: Date,
): Promise<TrackingEventRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(trackingEvents)
    .where(gte(trackingEvents.timestamp, since))
    .orderBy(desc(trackingEvents.timestamp), desc(trackingEvents.id));
  return rows.map(row => ({
    id: row.id,
    timestamp: row.timestamp,
    event: row.event,
    details: parseDetails(row.details),
  }));
}
