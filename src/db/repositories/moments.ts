import {and, asc, desc, eq, gte, lte, sql} from 'drizzle-orm';

import {deleteMomentContentFile} from '@/lib/moments/moment-storage';
import {parseNotePhotoAttachments} from '@/lib/moments/note-photo-attachments';
import {getDayRange} from '@/lib/day-utils';

import {getDatabase} from '../client';
import {moments} from '../schema';

export type MomentType = 'photo' | 'note' | 'video' | 'voice';

export type MomentRow = {
  id: number;
  type: MomentType;
  timestamp: Date;
  finishedAt: Date | null;
  lat: number | null;
  lng: number | null;
  contentPath: string | null;
  voiceAttachmentPath: string | null;
  voiceAttachmentBytes: number | null;
  voiceDurationSec: number | null;
  photoAttachmentsJson: string | null;
  textBody: string | null;
  caption: string | null;
  title: string | null;
  moodScore: number | null;
  moodLabel: string | null;
  placeLabel: string | null;
  linkedPointId: number | null;
  contentBytes: number | null;
  sourceBytes: number | null;
  contentFormat: string | null;
  shareVisibility: string;
  contentSyncState: string;
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
  contentPath?: string | null;
  voiceAttachmentPath?: string | null;
  voiceAttachmentBytes?: number | null;
  voiceDurationSec?: number | null;
  photoAttachmentsJson?: string | null;
  contentBytes?: number | null;
  sourceBytes?: number | null;
  contentFormat?: string | null;
  placeLabel?: string | null;
};

function mapRow(row: typeof moments.$inferSelect): MomentRow {
  return {
    id: row.id,
    type: row.type,
    timestamp: row.timestamp,
    finishedAt: row.finishedAt ?? null,
    lat: row.lat ?? null,
    lng: row.lng ?? null,
    contentPath: row.contentPath ?? null,
    voiceAttachmentPath: row.voiceAttachmentPath ?? null,
    voiceAttachmentBytes: row.voiceAttachmentBytes ?? null,
    voiceDurationSec: row.voiceDurationSec ?? null,
    photoAttachmentsJson: row.photoAttachmentsJson ?? null,
    textBody: row.textBody ?? null,
    caption: row.caption ?? null,
    title: row.title ?? null,
    moodScore: row.moodScore ?? null,
    moodLabel: row.moodLabel ?? null,
    placeLabel: row.placeLabel ?? null,
    linkedPointId: row.linkedPointId ?? null,
    contentBytes: row.contentBytes ?? null,
    sourceBytes: row.sourceBytes ?? null,
    contentFormat: row.contentFormat ?? null,
    shareVisibility: row.shareVisibility,
    contentSyncState: row.contentSyncState,
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
      lat: null,
      lng: null,
      linkedPointId: null,
      title: input.title ?? null,
      textBody: input.textBody ?? null,
      caption: input.caption ?? null,
      moodScore: input.moodScore ?? null,
      moodLabel: input.moodLabel ?? null,
      placeLabel: input.placeLabel ?? null,
      contentPath: input.contentPath ?? null,
      voiceAttachmentPath: input.voiceAttachmentPath ?? null,
      voiceAttachmentBytes: input.voiceAttachmentBytes ?? null,
      voiceDurationSec: input.voiceDurationSec ?? null,
      photoAttachmentsJson: input.photoAttachmentsJson ?? null,
      contentBytes: input.contentBytes ?? null,
      sourceBytes: input.sourceBytes ?? null,
      contentFormat: input.contentFormat ?? null,
    })
    .returning();

  const row = mapRow(rows[0]!);
  notifyMomentChange(row.timestamp);
  return row;
}

export async function getMomentById(id: number): Promise<MomentRow | null> {
  const db = await getDatabase();
  const rows = await db.select().from(moments).where(eq(moments.id, id)).limit(1);
  return rows[0] ? mapRow(rows[0]) : null;
}

export async function getMomentsForDay(start: Date, end: Date): Promise<MomentRow[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(moments)
    .where(and(gte(moments.timestamp, start), lte(moments.timestamp, end)))
    .orderBy(asc(moments.timestamp));
  return rows.map(mapRow);
}

export async function getMomentsDayFingerprint(dateKey: string): Promise<string> {
  const {start, end} = getDayRange(dateKey);
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
  await deleteMomentContentFile(existing.voiceAttachmentPath);
  for (const attachment of parseNotePhotoAttachments(existing.photoAttachmentsJson)) {
    await deleteMomentContentFile(attachment.path);
  }
  notifyMomentChange(existing.timestamp);
}
