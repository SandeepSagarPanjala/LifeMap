import {and, asc, eq, sql} from 'drizzle-orm';

import {getDatabase} from '../client';
import {materializationQueue} from '../schema';

export type MaterializationJobType = 'persist_day' | 'seal_day';

export type MaterializationJob = {
  id: number;
  jobType: MaterializationJobType;
  dateKey: string;
  status: string;
  attempts: number;
  createdAt: Date;
};

function mapRow(
  row: typeof materializationQueue.$inferSelect,
): MaterializationJob {
  return {
    id: row.id,
    jobType: row.jobType as MaterializationJobType,
    dateKey: row.dateKey,
    status: row.status,
    attempts: row.attempts,
    createdAt: row.createdAt,
  };
}

export async function enqueueMaterializationJob(
  jobType: MaterializationJobType,
  dateKey: string,
): Promise<void> {
  const db = await getDatabase();
  const pending = await db
    .select({id: materializationQueue.id})
    .from(materializationQueue)
    .where(
      and(
        eq(materializationQueue.jobType, jobType),
        eq(materializationQueue.dateKey, dateKey),
        eq(materializationQueue.status, 'pending'),
      ),
    )
    .limit(1);

  if (pending.length > 0) {
    return;
  }

  await db.insert(materializationQueue).values({
    jobType,
    dateKey,
    status: 'pending',
    createdAt: new Date(),
  });
}

export async function claimPendingJobs(
  limit: number,
): Promise<MaterializationJob[]> {
  const db = await getDatabase();
  const rows = await db
    .select()
    .from(materializationQueue)
    .where(eq(materializationQueue.status, 'pending'))
    .orderBy(asc(materializationQueue.createdAt))
    .limit(limit);

  const claimed: MaterializationJob[] = [];
  for (const row of rows) {
    await db
      .update(materializationQueue)
      .set({status: 'processing'})
      .where(eq(materializationQueue.id, row.id));
    claimed.push(mapRow(row));
  }
  return claimed;
}

export async function markJobDone(jobId: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(materializationQueue)
    .set({status: 'done'})
    .where(eq(materializationQueue.id, jobId));
}

export async function markJobFailed(jobId: number): Promise<void> {
  const db = await getDatabase();
  await db
    .update(materializationQueue)
    .set({
      status: 'pending',
      attempts: sql`${materializationQueue.attempts} + 1`,
    })
    .where(eq(materializationQueue.id, jobId));
}

export async function countPendingJobs(): Promise<number> {
  const db = await getDatabase();
  const rows = await db
    .select({id: materializationQueue.id})
    .from(materializationQueue)
    .where(eq(materializationQueue.status, 'pending'));
  return rows.length;
}
