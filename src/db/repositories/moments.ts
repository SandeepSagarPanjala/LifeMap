import { and, asc, desc, eq, gt, gte, isNull, lt, lte, or, sql } from 'drizzle-orm';

import { deleteMomentContentFile } from '@/lib/moments/moment-storage';
import { parseNotePhotoAttachments } from '@/lib/moments/note-photo-attachments';
import { sanitizePhotoAttachmentsJson } from '@/lib/db/json-blobs';
import { sanitizeMomentTagsJson } from '@/lib/moments/moment-tags';
import { getDayRange, toDateKey } from '@/lib/day-utils';

import { getDatabase } from '../client';
import { moments } from '../schema';

export type MomentType =
  | 'photo'
  | 'note'
  | 'video'
  | 'voice'
  | 'activity'
  | 'mood';

export type MomentRow = {
  id: number;
  type: MomentType;
  timestamp: Date;
  finishedAt: Date | null;
  contentPath: string | null;
  thumbnailPath: string | null;
  voiceAttachmentPath: string | null;
  voiceAttachmentBytes: number | null;
  voiceDurationSec: number | null;
  voiceTranscript: string | null;
  photoAttachmentsJson: string | null;
  tagsJson: string | null;
  textBody: string | null;
  caption: string | null;
  title: string | null;
  moodScore: number | null;
  moodLabel: string | null;
  moodReason: string | null;
  moodVariant: string | null;
  placeLabel: string | null;
  contentBytes: number | null;
  sourceBytes: number | null;
  contentFormat: string | null;
  shareVisibility: string;
  contentSyncState: string;
  activityId: number | null;
  activityEmoji: string | null;
  activityLabel: string | null;
  activityValuesJson: string | null;
};

export type NewMoment = {
  type: MomentType;
  timestamp: Date;
  finishedAt?: Date | null;
  title?: string | null;
  textBody?: string | null;
  caption?: string | null;
  moodScore?: number | null;
  moodLabel?: string | null;
  moodReason?: string | null;
  moodVariant?: string | null;
  contentPath?: string | null;
  thumbnailPath?: string | null;
  voiceAttachmentPath?: string | null;
  voiceAttachmentBytes?: number | null;
  voiceDurationSec?: number | null;
  voiceTranscript?: string | null;
  photoAttachmentsJson?: string | null;
  tagsJson?: string | null;
  contentBytes?: number | null;
  sourceBytes?: number | null;
  contentFormat?: string | null;
  placeLabel?: string | null;
  activityId?: number | null;
  activityEmoji?: string | null;
  activityLabel?: string | null;
  activityValuesJson?: string | null;
};

function mapRow(row: typeof moments.$inferSelect): MomentRow {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.timestamp,
    finishedAt: row.finishedAt ?? null,
    contentPath: row.contentPath ?? null,
    thumbnailPath: row.thumbnailPath ?? null,
    voiceAttachmentPath: row.voiceAttachmentPath ?? null,
    voiceAttachmentBytes: row.voiceAttachmentBytes ?? null,
    voiceDurationSec: row.voiceDurationSec ?? null,
    voiceTranscript: row.voiceTranscript ?? null,
    photoAttachmentsJson: sanitizePhotoAttachmentsJson(
      row.photoAttachmentsJson,
    ),
    tagsJson: sanitizeMomentTagsJson(row.tagsJson),
    textBody: row.textBody ?? null,
    caption: row.caption ?? null,
    title: row.title ?? null,
    moodScore: row.moodScore ?? null,
    moodLabel: row.moodLabel ?? null,
    moodReason: row.moodReason ?? null,
    moodVariant: row.moodVariant ?? null,
    placeLabel: row.placeLabel ?? null,
    contentBytes: row.contentBytes ?? null,
    sourceBytes: row.sourceBytes ?? null,
    contentFormat: row.contentFormat ?? null,
    shareVisibility: row.shareVisibility,
    contentSyncState: row.contentSyncState,
    activityId: row.activityId ?? null,
    activityEmoji: row.activityEmoji ?? null,
    activityLabel: row.activityLabel ?? null,
    activityValuesJson: row.activityValuesJson ?? null,
  };
}

export async function insertMoment(input: NewMoment): Promise<MomentRow> {
  const db = await getDatabase();
  const rows = await db
    .insert(moments)
    .values({
      type: input.type,
      timestamp: input.timestamp,
      finishedAt: input.finishedAt ?? null,
      title: input.title ?? null,
      textBody: input.textBody ?? null,
      caption: input.caption ?? null,
      moodScore: input.moodScore ?? null,
      moodLabel: input.moodLabel ?? null,
      moodReason: input.moodReason ?? null,
      moodVariant: input.moodVariant ?? null,
      placeLabel: input.placeLabel ?? null,
      contentPath: input.contentPath ?? null,
      thumbnailPath: input.thumbnailPath ?? null,
      voiceAttachmentPath: input.voiceAttachmentPath ?? null,
      voiceAttachmentBytes: input.voiceAttachmentBytes ?? null,
      voiceDurationSec: input.voiceDurationSec ?? null,
      voiceTranscript: input.voiceTranscript ?? null,
      photoAttachmentsJson: sanitizePhotoAttachmentsJson(
        input.photoAttachmentsJson ?? null,
      ),
      tagsJson: sanitizeMomentTagsJson(input.tagsJson ?? null),
      contentBytes: input.contentBytes ?? null,
      sourceBytes: input.sourceBytes ?? null,
      contentFormat: input.contentFormat ?? null,
      activityId: input.activityId ?? null,
      activityEmoji: input.activityEmoji ?? null,
      activityLabel: input.activityLabel ?? null,
      activityValuesJson: input.activityValuesJson ?? null,
    })
    .returning();

  const row = mapRow(rows[0]!);
  notifyMomentChange(row.timestamp);
  return row;
}

export async function updateMomentThumbnailPath(
  id: number,
  thumbnailPath: string,
): Promise<void> {
  const db = await getDatabase();
  const existing = await getMomentById(id);
  await db
    .update(moments)
    .set({ thumbnailPath })
    .where(eq(moments.id, id));
  if (existing?.thumbnailPath && existing.thumbnailPath !== thumbnailPath) {
    await deleteMomentContentFile(existing.thumbnailPath);
  }
  if (existing) {
    notifyMomentChange(existing.timestamp);
  }
}

/** Clear thumbnail_path on all photo/video rows (files deleted). Used before regen. */
export async function clearAllMomentThumbnails(): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .select({
      id: moments.id,
      thumbnailPath: moments.thumbnailPath,
    })
    .from(moments)
    .where(
      and(
        or(eq(moments.type, 'photo'), eq(moments.type, 'video')),
        sql`${moments.thumbnailPath} is not null`,
      ),
    );

  for (const row of rows) {
    await deleteMomentContentFile(row.thumbnailPath);
  }

  if (rows.length > 0) {
    await db
      .update(moments)
      .set({ thumbnailPath: null })
      .where(or(eq(moments.type, 'photo'), eq(moments.type, 'video')));
  }

  return rows.length;
}

export async function getMomentById(id: number): Promise<MomentRow | null> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(eq(moments.id, id))
    .limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getMomentsForDay(
  start: Date,
  end: Date,
): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(and(gte(moments.timestamp, start), lte(moments.timestamp, end)))
    .orderBy(asc(moments.timestamp));
  return rows.map(mapRow);
}

/**
 * Distinct calendar days (APP_TIMEZONE) that have moments, newest first.
 * Cursor: pass the oldest already-loaded dateKey to page further back.
 */
export async function listMomentDateKeysBefore(
  beforeDateKey: string | null,
  limit: number,
): Promise<string[]> {
  if (limit <= 0) {
    return [];
  }

  const db = await getDatabase();
  const beforeStart = beforeDateKey
    ? getDayRange(beforeDateKey).start
    : null;

  const keys: string[] = [];
  const seen = new Set<string>();
  let cursorTs: Date | null = beforeStart;
  // Oversample timestamps; group in JS with timezone-correct toDateKey.
  const batchSize = Math.max(limit * 40, 80);
  let guard = 0;

  while (keys.length < limit && guard < 40) {
    guard += 1;
    const rows = cursorTs
      ? await db
          .select({ timestamp: moments.timestamp })
          .from(moments)
          .where(lt(moments.timestamp, cursorTs))
          .orderBy(desc(moments.timestamp))
          .limit(batchSize)
      : await db
          .select({ timestamp: moments.timestamp })
          .from(moments)
          .orderBy(desc(moments.timestamp))
          .limit(batchSize);

    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const key = toDateKey(row.timestamp);
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
        if (keys.length >= limit) {
          break;
        }
      }
    }

    cursorTs = rows[rows.length - 1]!.timestamp;
    if (rows.length < batchSize) {
      break;
    }
  }

  return keys;
}

/** Load all moments for the given date keys (asc within each day overall). */
export async function getMomentsForDateKeys(
  dateKeys: string[],
): Promise<MomentRow[]> {
  if (dateKeys.length === 0) {
    return [];
  }

  const ranges = dateKeys.map(getDayRange);
  const earliest = ranges.reduce((min, r) =>
    r.start.getTime() < min.getTime() ? r.start : min,
  ranges[0]!.start);
  const latest = ranges.reduce((max, r) =>
    r.end.getTime() > max.getTime() ? r.end : max,
  ranges[0]!.end);

  const allowed = new Set(dateKeys);
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(
      and(gte(moments.timestamp, earliest), lte(moments.timestamp, latest)),
    )
    .orderBy(asc(moments.timestamp), asc(moments.id));

  return rows.map(mapRow).filter(row => allowed.has(toDateKey(row.timestamp)));
}

export async function updateMomentTagsJson(
  id: number,
  tagsJson: string | null,
): Promise<void> {
  const db = await getDatabase();
  const existing = await getMomentById(id);
  // Explicit `[]` means "labeled, nothing found" so backfill won't retry.
  const next =
    tagsJson === '[]' ? '[]' : sanitizeMomentTagsJson(tagsJson);
  await db
    .update(moments)
    .set({ tagsJson: next })
    .where(eq(moments.id, id));
  if (existing) {
    notifyMomentChange(existing.timestamp);
  }
}

export async function listMomentsMissingTags(
  limit = 50,
  afterId = 0,
): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(
      and(
        or(eq(moments.type, 'photo'), eq(moments.type, 'video')),
        or(isNull(moments.tagsJson), eq(moments.tagsJson, '')),
        gt(moments.id, afterId),
      ),
    )
    .orderBy(asc(moments.id))
    .limit(limit);
  return rows.map(mapRow);
}

export async function countMomentsMissingTags(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(moments)
    .where(
      and(
        or(eq(moments.type, 'photo'), eq(moments.type, 'video')),
        or(isNull(moments.tagsJson), eq(moments.tagsJson, '')),
      ),
    );
  return row?.count ?? 0;
}

/** @deprecated Prefer listMomentsMissingTags. */
export const listPhotoMomentsMissingTags = listMomentsMissingTags;
/** @deprecated Prefer countMomentsMissingTags. */
export const countPhotoMomentsMissingTags = countMomentsMissingTags;

export async function listMomentsMissingThumbnails(
  limit = 50,
  afterId = 0,
): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(
      and(
        or(eq(moments.type, 'photo'), eq(moments.type, 'video')),
        isNull(moments.thumbnailPath),
        gt(moments.id, afterId),
      ),
    )
    .orderBy(asc(moments.id))
    .limit(limit);
  return rows.map(mapRow);
}

export async function countMomentsMissingThumbnails(): Promise<number> {
  const db = await getDatabase();
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
    })
    .from(moments)
    .where(
      and(
        or(eq(moments.type, 'photo'), eq(moments.type, 'video')),
        isNull(moments.thumbnailPath),
      ),
    );
  return row?.count ?? 0;
}

export async function getMomentsDayFingerprint(
  dateKey: string,
): Promise<string> {
  const { start, end } = getDayRange(dateKey);
  const db = await getDatabase();
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as integer)`,
      maxId: sql<number>`coalesce(max(${moments.id}), 0)`,
    })
    .from(moments)
    .where(and(gte(moments.timestamp, start), lte(moments.timestamp, end)));
  return `${row?.count ?? 0}:${row?.maxId ?? 0}`;
}

type MomentChangeListener = (timestamp: Date) => void;

const changeListeners = new Set<MomentChangeListener>();

function notifyMomentChange(timestamp: Date): void {
  for (const listener of changeListeners) {
    listener(timestamp);
  }
}

export function subscribeMomentChanges(
  listener: MomentChangeListener,
): () => void {
  changeListeners.add(listener);
  return () => {
    changeListeners.delete(listener);
  };
}

export async function getRecentMoments(limit = 20): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .orderBy(desc(moments.timestamp), desc(moments.id))
    .limit(limit);
  return rows.map(mapRow);
}

/** All diary (note) moments, newest first. */
export async function listNoteMoments(): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(eq(moments.type, 'note'))
    .orderBy(desc(moments.timestamp), desc(moments.id));
  return rows.map(mapRow);
}

export async function getAllMoments(): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .orderBy(asc(moments.timestamp), asc(moments.id));
  return rows.map(mapRow);
}

export async function deleteMoment(id: number): Promise<void> {
  const existing = await getMomentById(id);
  if (!existing) {
    return;
  }

  const db = await getDatabase();
  await db.delete(moments).where(eq(moments.id, id));
  await deleteMomentContentFile(existing.contentPath);
  await deleteMomentContentFile(existing.thumbnailPath);
  await deleteMomentContentFile(existing.voiceAttachmentPath);
  for (const attachment of parseNotePhotoAttachments(
    existing.photoAttachmentsJson,
  )) {
    await deleteMomentContentFile(attachment.path);
  }
  notifyMomentChange(existing.timestamp);
}
